import type { FlashcardLearningState } from "@prisma/client";
import type { FlashcardRatingInput } from "../schemas";

type SchedulerInput = {
  rating: FlashcardRatingInput;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  reviewedAt: Date;
};

export type SchedulerResult = {
  state: FlashcardLearningState;
  dueAt: Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;

function clampEase(value: number) {
  return Math.max(1.3, Math.round(value * 100) / 100);
}

export function scheduleFlashcard(input: SchedulerInput): SchedulerResult {
  const { rating, reviewedAt } = input;

  if (rating === "AGAIN") {
    return {
      state: "LEARNING",
      dueAt: new Date(reviewedAt.getTime() + 10 * MINUTE_IN_MS),
      intervalDays: 0,
      easeFactor: clampEase(input.easeFactor - 0.2),
      repetitions: 0,
      lapses: input.lapses + 1,
    };
  }

  if (rating === "HARD") {
    const intervalDays = Math.max(1, Math.ceil(Math.max(1, input.intervalDays) * 1.2));
    return {
      state: "REVIEW",
      dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
      intervalDays,
      easeFactor: clampEase(input.easeFactor - 0.15),
      repetitions: input.repetitions + 1,
      lapses: input.lapses,
    };
  }

  if (rating === "EASY") {
    const intervalDays =
      input.repetitions === 0
        ? 4
        : Math.max(4, Math.round(Math.max(1, input.intervalDays) * input.easeFactor * 1.3));
    return {
      state: "REVIEW",
      dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
      intervalDays,
      easeFactor: clampEase(input.easeFactor + 0.15),
      repetitions: input.repetitions + 1,
      lapses: input.lapses,
    };
  }

  const intervalDays =
    input.repetitions === 0
      ? 1
      : input.repetitions === 1
        ? 3
        : Math.max(3, Math.round(Math.max(1, input.intervalDays) * input.easeFactor));

  return {
    state: "REVIEW",
    dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
    intervalDays,
    easeFactor: clampEase(input.easeFactor),
    repetitions: input.repetitions + 1,
    lapses: input.lapses,
  };
}
