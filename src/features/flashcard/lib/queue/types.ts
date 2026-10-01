import type { FlashcardCardQueue, FlashcardCardType } from "@prisma/client";

/**
 * Kartu kandidat untuk antrean. Konten kata tidak ikut — antrean hanya butuh
 * jadwal. Antrean selalu untuk satu deck, dan di satu deck satu kata = satu
 * kartu, jadi `vocabId` sekaligus identitas kartu.
 *
 * Kandidat yang di-suspend atau sedang ditunda sudah disaring di query, bukan
 * di sini.
 */
export type QueueCandidate = {
  vocabId: number;
  type: FlashcardCardType;
  queue: FlashcardCardQueue;
  due: Date;
  /** Posisi kartu baru menurut insertion order; tidak dipakai kartu lain. */
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

/** Kelompok pengambilan Anki v3, berurutan dari prioritas tertinggi. */
export const QUEUE_GROUPS = [
  "intradayLearning",
  "interdayLearning",
  "review",
  "new",
] as const;

export type QueueGroup = (typeof QUEUE_GROUPS)[number];

export type QueueEntry = QueueCandidate & { group: QueueGroup };

/** Sisa jatah hari ini (sudah dikurangi yang dipelajari hari ini). */
export type QueueBudget = {
  newLimit: number;
  reviewLimit: number;
};

export type QueueCounts = {
  intradayLearning: number;
  interdayLearning: number;
  review: number;
  new: number;
};
