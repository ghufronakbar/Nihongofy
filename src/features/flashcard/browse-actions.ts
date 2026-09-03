"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayContextOf, ensureCollection } from "./lib/collection";
import { getFlashcardDayEnd } from "./lib/scheduler/day";

/**
 * Aksi massal card browser.
 *
 * Semuanya memakai `updateMany` dengan filter `userId`, sehingga kepemilikan
 * ditegakkan di query — bukan lewat pemeriksaan terpisah yang bisa terlewat.
 */

const CardIdsSchema = z
  .array(z.string().regex(/^\d+$/))
  .min(1)
  .max(1_000);

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string };

async function requireSession() {
  const session = await getSession();
  return session ?? null;
}

function toBigInts(ids: string[]) {
  return ids.map((id) => BigInt(id));
}

export async function bulkSuspendAction(input: {
  cardIds: string[];
  suspend: boolean;
}): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ cardIds: CardIdsSchema, suspend: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pilihan kartu tidak valid." };

  const ids = toBigInts(parsed.data.cardIds);

  if (parsed.data.suspend) {
    const updated = await prisma.flashcardCard.updateMany({
      where: { id: { in: ids }, userId: session.userId },
      data: { queue: "SUSPENDED" },
    });
    revalidatePath("/flashcard/browse");
    return { ok: true, data: { count: updated.count } };
  }

  // Queue dipulihkan dari `type`, karena nilai queue sebelumnya sudah tertimpa.
  const cards = await prisma.flashcardCard.findMany({
    where: { id: { in: ids }, userId: session.userId, queue: "SUSPENDED" },
    select: { id: true, type: true },
  });

  const groups: Record<string, bigint[]> = { NEW: [], REVIEW: [], LEARNING: [] };
  for (const card of cards) {
    const target = card.type === "NEW" ? "NEW" : card.type === "REVIEW" ? "REVIEW" : "LEARNING";
    groups[target]!.push(card.id);
  }

  await prisma.$transaction(
    Object.entries(groups)
      .filter(([, list]) => list.length > 0)
      .map(([queue, list]) =>
        prisma.flashcardCard.updateMany({
          where: { id: { in: list }, userId: session.userId },
          data: { queue: queue as "NEW" | "REVIEW" | "LEARNING" },
        }),
      ),
  );

  revalidatePath("/flashcard/browse");
  return { ok: true, data: { count: cards.length } };
}

export async function bulkBuryAction(input: {
  cardIds: string[];
}): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z.object({ cardIds: CardIdsSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pilihan kartu tidak valid." };

  const collection = await ensureCollection(session.userId);
  const nextDay = getFlashcardDayEnd(new Date(), dayContextOf(collection));

  const updated = await prisma.flashcardCard.updateMany({
    where: {
      id: { in: toBigInts(parsed.data.cardIds) },
      userId: session.userId,
      queue: { not: "SUSPENDED" },
    },
    data: { queue: "BURIED_USER", due: nextDay },
  });

  revalidatePath("/flashcard/browse");
  return { ok: true, data: { count: updated.count } };
}

/**
 * Mengembalikan kartu ke keadaan baru.
 *
 * Seluruh memory state FSRS dihapus, bukan sekadar due-nya dimundurkan — kalau
 * stability dibiarkan, kartu "baru" itu akan langsung melompat ke interval
 * panjang begitu dijawab.
 */
export async function bulkForgetAction(input: {
  cardIds: string[];
}): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z.object({ cardIds: CardIdsSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pilihan kartu tidak valid." };

  const updated = await prisma.flashcardCard.updateMany({
    where: { id: { in: toBigInts(parsed.data.cardIds) }, userId: session.userId },
    data: {
      type: "NEW",
      queue: "NEW",
      due: new Date(),
      intervalDays: 0,
      reps: 0,
      lapses: 0,
      learningStep: 0,
      stability: null,
      difficulty: null,
      desiredRetention: null,
      easeFactor: null,
      lastReviewedAt: null,
    },
  });

  revalidatePath("/flashcard/browse");
  revalidatePath("/flashcard");
  return { ok: true, data: { count: updated.count } };
}

export async function bulkMoveDeckAction(input: {
  cardIds: string[];
  deckId: number;
}): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ cardIds: CardIdsSchema, deckId: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pilihan tidak valid." };

  const deck = await prisma.flashcardDeck.findFirst({
    where: { id: parsed.data.deckId, userId: session.userId },
    select: { id: true },
  });
  if (!deck) return { ok: false, message: "Deck tujuan tidak ditemukan." };

  const updated = await prisma.flashcardCard.updateMany({
    where: { id: { in: toBigInts(parsed.data.cardIds) }, userId: session.userId },
    data: { deckId: deck.id },
  });

  revalidatePath("/flashcard/browse");
  revalidatePath("/flashcard");
  return { ok: true, data: { count: updated.count } };
}

/**
 * Menghapus note beserta seluruh kartunya, mengikuti Anki: kartu tidak bisa
 * dihapus sendirian karena selalu turunan dari sebuah note.
 */
export async function bulkDeleteNotesAction(input: {
  cardIds: string[];
}): Promise<ActionResult<{ notes: number }>> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z.object({ cardIds: CardIdsSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pilihan kartu tidak valid." };

  const cards = await prisma.flashcardCard.findMany({
    where: { id: { in: toBigInts(parsed.data.cardIds) }, userId: session.userId },
    select: { noteId: true },
  });
  const noteIds = [...new Set(cards.map((card) => card.noteId))];
  if (noteIds.length === 0) return { ok: true, data: { notes: 0 } };

  const deleted = await prisma.flashcardNote.deleteMany({
    where: { id: { in: noteIds }, userId: session.userId },
  });

  revalidatePath("/flashcard/browse");
  revalidatePath("/flashcard");
  return { ok: true, data: { notes: deleted.count } };
}

/** Menempatkan ulang kartu baru di antrean, padanan "Reposition" di Anki. */
export async function repositionAction(input: {
  cardIds: string[];
  startPosition: number;
}): Promise<ActionResult<{ count: number }>> {
  const session = await requireSession();
  if (!session) return { ok: false, message: "Masuk dulu." };

  const parsed = z
    .object({ cardIds: CardIdsSchema, startPosition: z.number().int().min(0).max(1_000_000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Posisi tidak valid." };

  const cards = await prisma.flashcardCard.findMany({
    where: {
      id: { in: toBigInts(parsed.data.cardIds) },
      userId: session.userId,
      queue: "NEW",
    },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (cards.length === 0) {
    return { ok: false, message: "Tidak ada kartu baru pada pilihan itu." };
  }

  const updates: Prisma.PrismaPromise<unknown>[] = cards.map((card, index) =>
    prisma.flashcardCard.update({
      where: { id: card.id },
      data: { position: parsed.data.startPosition + index },
    }),
  );
  await prisma.$transaction(updates);

  revalidatePath("/flashcard/browse");
  return { ok: true, data: { count: cards.length } };
}
