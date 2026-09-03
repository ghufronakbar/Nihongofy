"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCollection, ensureDefaultPreset } from "./lib/collection";
import { buildFsrsScheduler } from "./lib/scheduler/fsrs";
import {
  FLASHCARD_DEFAULT_PRESET_CONFIG,
  FlashcardPresetConfigSchema,
  FlashcardPresetNameSchema,
  parsePresetConfig,
  type FlashcardPresetConfig,
} from "./schemas";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const SavePresetSchema = z.object({
  presetId: z.number().int().positive(),
  name: FlashcardPresetNameSchema,
  config: FlashcardPresetConfigSchema,
});

/**
 * Menyimpan deck options.
 *
 * Preset dipakai bersama beberapa deck, jadi perubahan di sini berlaku untuk
 * semuanya — itu perilaku Anki, dan UI harus menyatakannya.
 */
export async function savePresetAction(input: {
  presetId: number;
  name: string;
  config: unknown;
}): Promise<ActionResult<{ rescheduledCards: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = SavePresetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid.",
    };
  }

  const preset = await prisma.flashcardPreset.findFirst({
    where: { id: parsed.data.presetId, userId: session.userId },
    select: { id: true, config: true },
  });
  if (!preset) return { ok: false, message: "Preset tidak ditemukan." };

  const previous = parsePresetConfig(preset.config);
  const next = parsed.data.config;

  try {
    await prisma.flashcardPreset.update({
      where: { id: preset.id },
      data: {
        name: parsed.data.name,
        config: next as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "Sudah ada preset dengan nama itu." };
    }
    throw error;
  }

  const rescheduledCards = next.rescheduleCardsOnChange
    ? await rescheduleForPreset(session.userId, preset.id, previous, next)
    : 0;

  revalidatePath("/flashcard");
  return { ok: true, data: { rescheduledCards } };
}

/**
 * Menghitung ulang jadwal kartu review setelah preset berubah.
 *
 * Dihitung dari memory state yang tersimpan (`stability`), bukan dari mengulang
 * seluruh review history — sama seperti "Reschedule cards on change" di Anki, dan
 * jauh lebih murah. Kartu learning/relearning dilewati karena jadwalnya
 * ditentukan learning steps, bukan FSRS.
 */
async function rescheduleForPreset(
  userId: number,
  presetId: number,
  previous: FlashcardPresetConfig,
  next: FlashcardPresetConfig,
): Promise<number> {
  const retentionChanged = previous.desiredRetention !== next.desiredRetention;
  const parametersChanged =
    JSON.stringify(previous.fsrsParameters) !== JSON.stringify(next.fsrsParameters);
  const maximumChanged = previous.maximumIntervalDays !== next.maximumIntervalDays;
  if (!next.fsrsEnabled || (!retentionChanged && !parametersChanged && !maximumChanged)) {
    return 0;
  }

  const cards = await prisma.flashcardCard.findMany({
    where: {
      userId,
      deck: { presetId },
      type: "REVIEW",
      stability: { not: null },
      lastReviewedAt: { not: null },
    },
    select: { id: true, stability: true, lastReviewedAt: true, intervalDays: true },
    // Batas aman supaya satu penyimpanan preset tidak menyentuh puluhan ribu baris
    // dalam satu request serverless.
    take: 5_000,
  });
  if (cards.length === 0) return 0;

  const scheduler = buildFsrsScheduler(next);
  const updates = cards.flatMap((card) => {
    const interval = Math.min(
      next.maximumIntervalDays,
      Math.max(1, scheduler.next_interval(card.stability!, 0)),
    );
    if (interval === card.intervalDays) return [];

    return [
      prisma.flashcardCard.update({
        where: { id: card.id },
        data: {
          intervalDays: interval,
          due: new Date(card.lastReviewedAt!.getTime() + interval * DAY_IN_MS),
          desiredRetention: next.desiredRetention,
        },
      }),
    ];
  });

  if (updates.length === 0) return 0;
  await prisma.$transaction(updates);
  return updates.length;
}

export async function createPresetAction(input: {
  name: string;
  copyFromPresetId?: number;
}): Promise<ActionResult<{ presetId: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({
      name: FlashcardPresetNameSchema,
      copyFromPresetId: z.number().int().positive().optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nama tidak valid." };
  }

  await ensureCollection(session.userId);

  let config: FlashcardPresetConfig = FLASHCARD_DEFAULT_PRESET_CONFIG;
  if (parsed.data.copyFromPresetId) {
    const source = await prisma.flashcardPreset.findFirst({
      where: { id: parsed.data.copyFromPresetId, userId: session.userId },
      select: { config: true },
    });
    if (source) config = parsePresetConfig(source.config);
  }

  try {
    const preset = await prisma.flashcardPreset.create({
      data: {
        userId: session.userId,
        name: parsed.data.name,
        config: config as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    revalidatePath("/flashcard");
    return { ok: true, data: { presetId: preset.id } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "Sudah ada preset dengan nama itu." };
    }
    throw error;
  }
}

const AssignSchema = z.object({
  deckId: z.number().int().positive(),
  presetId: z.number().int().positive(),
  /** Terapkan juga ke seluruh subdeck, seperti "Save to all subdecks" di Anki. */
  includeSubdecks: z.boolean().default(false),
});

export async function assignPresetAction(input: {
  deckId: number;
  presetId: number;
  includeSubdecks?: boolean;
}): Promise<ActionResult<{ updatedDecks: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = AssignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pilihan tidak valid." };

  const [deck, preset] = await Promise.all([
    prisma.flashcardDeck.findFirst({
      where: { id: parsed.data.deckId, userId: session.userId },
      select: { id: true, name: true },
    }),
    prisma.flashcardPreset.findFirst({
      where: { id: parsed.data.presetId, userId: session.userId },
      select: { id: true },
    }),
  ]);
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };
  if (!preset) return { ok: false, message: "Preset tidak ditemukan." };

  const updated = await prisma.flashcardDeck.updateMany({
    where: {
      userId: session.userId,
      OR: parsed.data.includeSubdecks
        ? [{ id: deck.id }, { name: { startsWith: `${deck.name}::` } }]
        : [{ id: deck.id }],
    },
    data: { presetId: preset.id },
  });

  revalidatePath("/flashcard");
  return { ok: true, data: { updatedDecks: updated.count } };
}

export async function deletePresetAction(input: {
  presetId: number;
}): Promise<ActionResult<{ movedDecks: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z.object({ presetId: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Preset tidak valid." };

  const fallback = await ensureDefaultPreset(session.userId);
  if (fallback.id === parsed.data.presetId) {
    return { ok: false, message: "Preset default tidak bisa dihapus." };
  }

  const preset = await prisma.flashcardPreset.findFirst({
    where: { id: parsed.data.presetId, userId: session.userId },
    select: { id: true },
  });
  if (!preset) return { ok: false, message: "Preset tidak ditemukan." };

  // Deck dipindah ke preset default lebih dulu: relasi `presetId` memakai
  // onDelete: Restrict supaya deck tidak pernah kehilangan pengaturannya.
  const moved = await prisma.flashcardDeck.updateMany({
    where: { userId: session.userId, presetId: preset.id },
    data: { presetId: fallback.id },
  });
  await prisma.flashcardPreset.delete({ where: { id: preset.id } });

  revalidatePath("/flashcard");
  return { ok: true, data: { movedDecks: moved.count } };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
