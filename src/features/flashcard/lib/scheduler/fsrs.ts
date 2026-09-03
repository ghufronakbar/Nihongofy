import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { FlashcardCardQueue, FlashcardCardType } from "@prisma/client";
import type { FlashcardPresetConfig, FlashcardRatingInput } from "../../schemas";
import { isIntradayDue, type FlashcardDayContext } from "./day";
import type { SchedulerCardState, SchedulerInput, SchedulerResult } from "./types";

/**
 * Jembatan antara `FlashcardCard` milik kita dan `ts-fsrs` (FSRS-6).
 *
 * Seluruh matematika DSR ditangani ts-fsrs. Yang dikerjakan file ini hanya
 * konversi bentuk data plus dua hal yang tidak diketahui ts-fsrs:
 * pembedaan queue intraday/interday dan deteksi leech.
 */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const RATING_TO_GRADE: Record<FlashcardRatingInput, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};

const STATE_TO_TYPE: Record<State, FlashcardCardType> = {
  [State.New]: "NEW",
  [State.Learning]: "LEARNING",
  [State.Review]: "REVIEW",
  [State.Relearning]: "RELEARNING",
};

const TYPE_TO_STATE: Record<FlashcardCardType, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

// Skema sudah menjamin bentuk "<bilangan bulat>m|h" (lihat FlashcardStepSchema),
// jadi cast ini aman dan tidak perlu konversi apa pun.
type FsrsStep = `${number}${"m" | "h" | "d"}`;

export function buildFsrsScheduler(config: FlashcardPresetConfig) {
  return fsrs(
    generatorParameters({
      w: config.fsrsParameters,
      request_retention: config.desiredRetention,
      maximum_interval: config.maximumIntervalDays,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: config.learningSteps as FsrsStep[],
      relearning_steps: config.relearningSteps as FsrsStep[],
    }),
  );
}

function toFsrsCard(card: SchedulerCardState, now: Date): FsrsCard {
  if (card.type === "NEW" || card.stability === null || card.difficulty === null) {
    // Kartu baru: biarkan ts-fsrs yang menentukan state awal.
    return createEmptyCard(now);
  }

  const lastReview = card.lastReviewedAt ?? undefined;
  const elapsedDays = lastReview
    ? Math.max(0, Math.round((now.getTime() - lastReview.getTime()) / DAY_IN_MS))
    : 0;

  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: card.intervalDays,
    learning_steps: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: TYPE_TO_STATE[card.type],
    last_review: lastReview,
  };
}

/**
 * Queue turunan dari type + waktu due.
 *
 * Kartu learning/relearning yang due masih di hari yang sama masuk queue
 * `LEARNING`; yang menyeberang batas hari masuk `DAY_LEARN`. Pembedaan ini
 * dipakai queue gatherer (Fase C) untuk mengambil intraday sebelum interday.
 */
function resolveQueue(
  type: FlashcardCardType,
  due: Date,
  now: Date,
  day: FlashcardDayContext,
): FlashcardCardQueue {
  if (type === "REVIEW") return "REVIEW";
  if (type === "NEW") return "NEW";
  return isIntradayDue(due, now, day) ? "LEARNING" : "DAY_LEARN";
}

/**
 * Ambang leech Anki: tercapai saat `lapses` menyentuh threshold, lalu berulang
 * setiap setengah threshold sesudahnya (8, 12, 16, ... untuk threshold 8).
 */
function crossedLeechThreshold(lapses: number, threshold: number) {
  if (threshold <= 0 || lapses < threshold) return false;
  const step = Math.max(1, Math.floor(threshold / 2));
  return (lapses - threshold) % step === 0;
}

export function scheduleWithFsrs(input: SchedulerInput): SchedulerResult {
  const { card, rating, now, config, day } = input;

  const scheduler = buildFsrsScheduler(config);
  const { card: next } = scheduler.next(
    toFsrsCard(card, now),
    now,
    RATING_TO_GRADE[rating],
  );

  const type = STATE_TO_TYPE[next.state];
  const lapsed = next.lapses > card.lapses;

  return {
    card: {
      type,
      queue: resolveQueue(type, next.due, now, day),
      due: next.due,
      intervalDays: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      learningStep: next.learning_steps,
      stability: next.stability,
      difficulty: next.difficulty,
      desiredRetention: config.desiredRetention,
      easeFactor: card.easeFactor,
      lastReviewedAt: now,
    },
    revlog: {
      kind:
        card.type === "NEW" || card.type === "LEARNING"
          ? "LEARN"
          : card.type === "RELEARNING"
            ? "RELEARN"
            : "REVIEW",
      intervalDays: next.scheduled_days,
      lastIntervalDays: card.intervalDays,
      stability: next.stability,
      difficulty: next.difficulty,
      easeFactor: null,
    },
    becameLeech: lapsed && crossedLeechThreshold(next.lapses, config.leechThreshold),
  };
}

/**
 * Retrievability saat ini (0..1). Dipakai queue sorter untuk urutan
 * "ascending retrievability" — kartu yang paling berisiko lupa lebih dulu.
 */
export function getRetrievability(
  card: SchedulerCardState,
  now: Date,
  config: FlashcardPresetConfig,
): number {
  if (card.type === "NEW" || card.stability === null || card.difficulty === null) {
    return 0;
  }
  return buildFsrsScheduler(config).get_retrievability(toFsrsCard(card, now), now, false);
}
