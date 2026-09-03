import type {
  FlashcardCardQueue,
  FlashcardCardType,
  FlashcardRevlogKind,
} from "@prisma/client";
import type { FlashcardPresetConfig, FlashcardRatingInput } from "../../schemas";
import type { FlashcardDayContext } from "./day";

/** Bagian `FlashcardCard` yang dibutuhkan scheduler — sengaja bukan row Prisma utuh. */
export type SchedulerCardState = {
  type: FlashcardCardType;
  queue: FlashcardCardQueue;
  due: Date;
  intervalDays: number;
  reps: number;
  lapses: number;
  learningStep: number;
  stability: number | null;
  difficulty: number | null;
  desiredRetention: number | null;
  easeFactor: number | null;
  lastReviewedAt: Date | null;
};

export type SchedulerInput = {
  card: SchedulerCardState;
  rating: FlashcardRatingInput;
  now: Date;
  config: FlashcardPresetConfig;
  day: FlashcardDayContext;
};

export type SchedulerRevlogDraft = {
  kind: FlashcardRevlogKind;
  intervalDays: number;
  lastIntervalDays: number;
  stability: number | null;
  difficulty: number | null;
  easeFactor: number | null;
};

export type SchedulerResult = {
  card: SchedulerCardState;
  revlog: SchedulerRevlogDraft;
  /**
   * Kartu baru saja melewati ambang leech pada review ini. Aksi (suspend atau
   * tag) ditentukan `config.leechAction` dan dijalankan pemanggil, bukan di sini.
   */
  becameLeech: boolean;
};

export const FLASHCARD_RATINGS = ["AGAIN", "HARD", "GOOD", "EASY"] as const;

/** Interval yang akan didapat untuk tiap tombol, dipakai reviewer sebelum user memilih. */
export type SchedulerPreview = Record<FlashcardRatingInput, SchedulerResult>;
