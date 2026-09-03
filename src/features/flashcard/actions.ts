"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  dayContextOf,
  ensureCollection,
  ensureDeckPath,
  nextEntityId,
} from "./lib/collection";
import { getFlashcardDayEnd } from "./lib/scheduler/day";
import { scheduleReview } from "./lib/scheduler";
import type { SchedulerCardState } from "./lib/scheduler/types";
import { parsePresetConfig, FlashcardRatingSchema } from "./schemas";

const CardIdSchema = z.string().regex(/^\d+$/, "Kartu tidak valid.");

const AnswerSchema = z.object({
  cardId: CardIdSchema,
  rating: FlashcardRatingSchema,
  takenMs: z.number().int().min(0).max(3_600_000).default(0),
  /**
   * Token idempotency yang dibuat client sekali per kartu, dan DIPAKAI ULANG
   * saat retry. Unik per user (bukan primary key global), sehingga submit ganda
   * dari dua tab menjadi no-op alih-alih menggandakan review dan menembus
   * daily limit — tanpa membuka celah satu user memblokir user lain.
   */
  clientToken: z.string().trim().min(8).max(64),
});

export type AnswerCardInput = z.infer<typeof AnswerSchema>;

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

async function loadCardForUser(userId: number, cardId: bigint) {
  return prisma.flashcardCard.findFirst({
    where: { id: cardId, userId },
    select: {
      id: true,
      deckId: true,
      noteId: true,
      type: true,
      queue: true,
      due: true,
      intervalDays: true,
      reps: true,
      lapses: true,
      learningStep: true,
      stability: true,
      difficulty: true,
      desiredRetention: true,
      easeFactor: true,
      lastReviewedAt: true,
      deck: { select: { name: true, preset: { select: { config: true } } } },
    },
  });
}

export async function answerCardAction(
  input: AnswerCardInput,
): Promise<ActionResult<{ dueAt: string; intervalDays: number; becameLeech: boolean }>> {
  const session = await getSession();
  // Guest memakai mode coba: penjadwalan hanya hidup di state client dan tidak
  // pernah menyentuh database, jadi tidak ada yang dikerjakan di sini.
  if (!session) return { ok: false, message: "Masuk dulu untuk menyimpan progres." };

  const parsed = AnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Jawaban tidak valid." };

  const { cardId, rating, takenMs, clientToken } = parsed.data;
  const collection = await ensureCollection(session.userId);
  const card = await loadCardForUser(session.userId, BigInt(cardId));
  if (!card) return { ok: false, message: "Kartu tidak ditemukan." };

  const config = parsePresetConfig(card.deck.preset.config);
  const now = new Date();

  const state: SchedulerCardState = {
    type: card.type,
    queue: card.queue,
    due: card.due,
    intervalDays: card.intervalDays,
    reps: card.reps,
    lapses: card.lapses,
    learningStep: card.learningStep,
    stability: card.stability,
    difficulty: card.difficulty,
    desiredRetention: card.desiredRetention,
    easeFactor: card.easeFactor,
    lastReviewedAt: card.lastReviewedAt,
  };

  const result = scheduleReview({
    card: state,
    rating,
    now,
    config,
    day: dayContextOf(collection),
  });

  const leechSuspends = result.becameLeech && config.leechAction === "suspend";

  try {
    await prisma.$transaction([
      prisma.flashcardRevlog.create({
        data: {
          id: nextEntityId(now),
          userId: session.userId,
          clientToken,
          cardId: card.id,
          deckId: card.deckId,
          reviewedAt: now,
          rating,
          kind: result.revlog.kind,
          intervalDays: result.revlog.intervalDays,
          lastIntervalDays: result.revlog.lastIntervalDays,
          stability: result.revlog.stability,
          difficulty: result.revlog.difficulty,
          easeFactor: result.revlog.easeFactor,
          takenMs,
        },
      }),
      prisma.flashcardCard.update({
        where: { id: card.id },
        data: {
          type: result.card.type,
          queue: leechSuspends ? "SUSPENDED" : result.card.queue,
          due: result.card.due,
          intervalDays: result.card.intervalDays,
          reps: result.card.reps,
          lapses: result.card.lapses,
          learningStep: result.card.learningStep,
          stability: result.card.stability,
          difficulty: result.card.difficulty,
          desiredRetention: result.card.desiredRetention,
          easeFactor: result.card.easeFactor,
          lastReviewedAt: result.card.lastReviewedAt,
        },
      }),
    ]);
  } catch (error) {
    // P2002 pada (userId, clientToken) = review ini sudah tercatat. Itu justru
    // hasil yang diinginkan dari idempotency key, bukan kegagalan.
    if (isUniqueViolation(error)) {
      return {
        ok: true,
        data: {
          dueAt: result.card.due.toISOString(),
          intervalDays: result.card.intervalDays,
          becameLeech: false,
        },
      };
    }
    throw error;
  }

  if (result.becameLeech && config.leechAction === "tagOnly") {
    await tagAsLeech(session.userId, card.noteId);
  }

  revalidatePath("/flashcard");
  return {
    ok: true,
    data: {
      dueAt: result.card.due.toISOString(),
      intervalDays: result.card.intervalDays,
      becameLeech: result.becameLeech,
    },
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

const LEECH_TAG = "leech";

async function tagAsLeech(userId: number, noteId: bigint) {
  const note = await prisma.flashcardNote.findFirst({
    where: { id: noteId, userId },
    select: { tags: true },
  });
  if (!note || note.tags.includes(LEECH_TAG)) return;

  await prisma.flashcardNote.update({
    where: { id: noteId },
    data: { tags: { set: [...note.tags, LEECH_TAG] } },
  });
}

// --- Suspend / bury ---------------------------------------------------------

const CardActionSchema = z.object({ cardId: CardIdSchema });

export async function suspendCardAction(input: { cardId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  const updated = await prisma.flashcardCard.updateMany({
    where: { id: BigInt(parsed.data.cardId), userId: session.userId },
    data: { queue: "SUSPENDED" },
  });
  if (updated.count === 0) return { ok: false, message: "Kartu tidak ditemukan." };

  revalidatePath("/flashcard");
  return { ok: true };
}

export async function unsuspendCardAction(input: { cardId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  const card = await prisma.flashcardCard.findFirst({
    where: { id: BigInt(parsed.data.cardId), userId: session.userId },
    select: { id: true, type: true },
  });
  if (!card) return { ok: false, message: "Kartu tidak ditemukan." };

  // Queue dikembalikan dari `type`, karena `queue` sudah tertimpa SUSPENDED.
  const queue =
    card.type === "NEW" ? "NEW" : card.type === "REVIEW" ? "REVIEW" : "LEARNING";

  await prisma.flashcardCard.update({ where: { id: card.id }, data: { queue } });
  revalidatePath("/flashcard");
  return { ok: true };
}

/**
 * Bury manual: kartu disembunyikan sampai batas hari berikutnya. Anki menyimpan
 * ini sebagai queue khusus, bukan sebagai perubahan jadwal, sehingga interval
 * dan memory state kartu tidak tersentuh.
 */
export async function buryCardAction(input: { cardId: string }): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = CardActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Kartu tidak valid." };

  const collection = await ensureCollection(session.userId);
  const nextDay = getFlashcardDayEnd(new Date(), dayContextOf(collection));

  const updated = await prisma.flashcardCard.updateMany({
    where: { id: BigInt(parsed.data.cardId), userId: session.userId },
    data: { queue: "BURIED_USER", due: nextDay },
  });
  if (updated.count === 0) return { ok: false, message: "Kartu tidak ditemukan." };

  revalidatePath("/flashcard");
  return { ok: true };
}

/** Menandai sibling yang di-bury queue builder. Dijalankan sekali per sesi belajar. */
export async function markBuriedSiblingsAction(input: {
  cardIds: string[];
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const ids = z.array(CardIdSchema).max(2_000).safeParse(input.cardIds);
  if (!ids.success) return { ok: false, message: "Daftar kartu tidak valid." };
  if (ids.data.length === 0) return { ok: true };

  const collection = await ensureCollection(session.userId);
  const nextDay = getFlashcardDayEnd(new Date(), dayContextOf(collection));

  await prisma.flashcardCard.updateMany({
    where: {
      id: { in: ids.data.map((value) => BigInt(value)) },
      userId: session.userId,
      queue: { notIn: ["SUSPENDED", "BURIED_USER"] },
    },
    data: { queue: "BURIED_SIBLING", due: nextDay },
  });

  return { ok: true };
}

// --- Undo -------------------------------------------------------------------

/**
 * Undo mengembalikan kartu ke keadaan sebelum review terakhir.
 *
 * Nilai "sebelum" diambil dari revlog itu sendiri (`lastIntervalDays`, stability
 * dan difficulty sebelum review disimpan di baris sebelumnya), sehingga tidak
 * perlu tabel snapshot terpisah.
 */
export async function undoReviewAction(input: {
  clientToken: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ clientToken: z.string().trim().min(8).max(64) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Review tidak valid." };

  // Dicari lewat token yang sama dengan yang dipakai saat menjawab, bukan lewat
  // id revlog — client tidak pernah melihat id itu.
  const revlog = await prisma.flashcardRevlog.findUnique({
    where: {
      userId_clientToken: { userId: session.userId, clientToken: parsed.data.clientToken },
    },
    select: { id: true, cardId: true, lastIntervalDays: true, reviewedAt: true },
  });
  if (!revlog) return { ok: false, message: "Review tidak ditemukan." };

  const previous = await prisma.flashcardRevlog.findFirst({
    where: { cardId: revlog.cardId, reviewedAt: { lt: revlog.reviewedAt } },
    orderBy: { reviewedAt: "desc" },
    select: {
      reviewedAt: true,
      intervalDays: true,
      stability: true,
      difficulty: true,
      easeFactor: true,
    },
  });

  const card = await prisma.flashcardCard.findUnique({
    where: { id: revlog.cardId },
    select: { reps: true, lapses: true },
  });
  if (!card) return { ok: false, message: "Kartu tidak ditemukan." };

  await prisma.$transaction([
    prisma.flashcardCard.update({
      where: { id: revlog.cardId },
      data: {
        // Tanpa review sebelumnya, kartu kembali menjadi kartu baru.
        type: previous ? "REVIEW" : "NEW",
        queue: previous ? "REVIEW" : "NEW",
        due: previous
          ? new Date(previous.reviewedAt.getTime() + previous.intervalDays * 86_400_000)
          : revlog.reviewedAt,
        intervalDays: revlog.lastIntervalDays,
        reps: Math.max(0, card.reps - 1),
        lapses: card.lapses,
        learningStep: 0,
        stability: previous?.stability ?? null,
        difficulty: previous?.difficulty ?? null,
        easeFactor: previous?.easeFactor ?? null,
        lastReviewedAt: previous?.reviewedAt ?? null,
      },
    }),
    prisma.flashcardRevlog.delete({ where: { id: revlog.id } }),
  ]);

  revalidatePath("/flashcard");
  return { ok: true };
}

// --- Deck -------------------------------------------------------------------

const DeckNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value.split("::").every((segment) => segment.trim().length > 0),
    "Setiap bagian nama deck (dipisah ::) tidak boleh kosong.",
  );

export async function createDeckAction(input: {
  name: string;
  description?: string;
}): Promise<ActionResult<{ deckId: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ name: DeckNameSchema, description: z.string().trim().max(1_000).default("") })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nama deck tidak valid." };
  }

  await ensureCollection(session.userId);
  const preset = await prisma.flashcardPreset.findFirst({
    where: { userId: session.userId },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!preset) return { ok: false, message: "Preset default belum tersedia." };

  const existing = await prisma.flashcardDeck.findUnique({
    where: { userId_name: { userId: session.userId, name: parsed.data.name } },
    select: { id: true },
  });
  if (existing) return { ok: false, message: "Deck dengan nama itu sudah ada." };

  const deckId = await ensureDeckPath(session.userId, parsed.data.name, preset.id, {
    description: parsed.data.description,
    sourceKind: "MANUAL",
  });

  revalidatePath("/flashcard");
  return { ok: true, data: { deckId } };
}

/**
 * Rename memindahkan seluruh subtree, karena hierarki diturunkan dari nama.
 * Kalau hanya deck itu sendiri yang diganti, anak-anaknya akan menjadi yatim.
 */
export async function renameDeckAction(input: {
  deckId: number;
  name: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ deckId: z.number().int().positive(), name: DeckNameSchema })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nama deck tidak valid." };
  }

  const deck = await prisma.flashcardDeck.findFirst({
    where: { id: parsed.data.deckId, userId: session.userId },
    select: { id: true, name: true },
  });
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };
  if (deck.name === parsed.data.name) return { ok: true };

  const descendants = await prisma.flashcardDeck.findMany({
    where: { userId: session.userId, name: { startsWith: `${deck.name}::` } },
    select: { id: true, name: true },
  });

  const renames = [
    prisma.flashcardDeck.update({
      where: { id: deck.id },
      data: { name: parsed.data.name },
    }),
    ...descendants.map((child) =>
      prisma.flashcardDeck.update({
        where: { id: child.id },
        data: { name: `${parsed.data.name}${child.name.slice(deck.name.length)}` },
      }),
    ),
  ];

  try {
    await prisma.$transaction(renames);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "Nama itu bentrok dengan deck yang sudah ada." };
    }
    throw error;
  }

  revalidatePath("/flashcard");
  return { ok: true };
}

export async function deleteDeckAction(input: {
  deckId: number;
}): Promise<ActionResult<{ deletedDecks: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z.object({ deckId: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Deck tidak valid." };

  const deck = await prisma.flashcardDeck.findFirst({
    where: { id: parsed.data.deckId, userId: session.userId },
    select: { id: true, name: true },
  });
  if (!deck) return { ok: false, message: "Deck tidak ditemukan." };

  // Menghapus deck ikut menghapus kartunya (cascade), tapi note-nya sengaja
  // dibiarkan: note bisa punya kartu di deck lain.
  const deleted = await prisma.flashcardDeck.deleteMany({
    where: {
      userId: session.userId,
      OR: [{ id: deck.id }, { name: { startsWith: `${deck.name}::` } }],
    },
  });

  revalidatePath("/flashcard");
  return { ok: true, data: { deletedDecks: deleted.count } };
}
