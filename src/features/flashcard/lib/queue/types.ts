import type { FlashcardCardQueue, FlashcardCardType } from "@prisma/client";

/** Kartu kandidat untuk queue. Kolom konten note tidak ikut — queue hanya butuh jadwal. */
export type QueueCandidate = {
  cardId: string;
  noteId: string;
  deckId: number;
  ord: number;
  type: FlashcardCardType;
  queue: FlashcardCardQueue;
  due: Date;
  position: number;
  intervalDays: number;
  easeFactor: number | null;
  stability: number | null;
  difficulty: number | null;
  lastReviewedAt: Date | null;
  reps: number;
  lapses: number;
  learningStep: number;
};

/**
 * Kelompok pengambilan Anki. Urutannya menentukan prioritas: kelompok yang lebih
 * awal tidak bisa di-bury oleh kelompok yang lebih belakang.
 */
export const QUEUE_GROUPS = [
  "intradayLearning",
  "interdayLearning",
  "review",
  "new",
] as const;

export type QueueGroup = (typeof QUEUE_GROUPS)[number];

export type QueueEntry = QueueCandidate & { group: QueueGroup };

export type DeckBudget = {
  newLimit: number;
  reviewLimit: number;
};

export type QueueCounts = {
  intradayLearning: number;
  interdayLearning: number;
  review: number;
  new: number;
};
