import type { FlashcardLearningState } from "@prisma/client";
import type { FlashcardRatingInput } from "../schemas";
import type { FlashcardSchedulerSettings } from "./settings";

type SchedulerInput = {
  rating: FlashcardRatingInput;
  state: FlashcardLearningState;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  learningStep: number;
  reviewedAt: Date;
  settings: FlashcardSchedulerSettings;
};

export type SchedulerResult = {
  state: FlashcardLearningState;
  dueAt: Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  learningStep: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;

function clampEase(value: number) {
  return Math.min(5, Math.max(1.3, Math.round(value * 100) / 100));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * MINUTE_IN_MS);
}

function clampInterval(value: number, settings: FlashcardSchedulerSettings) {
  return Math.min(
    settings.maximumIntervalDays,
    Math.max(settings.minimumIntervalDays, Math.round(value)),
  );
}

export function scheduleFlashcard(input: SchedulerInput): SchedulerResult {
  const { rating, reviewedAt, settings } = input;
  const isInitialLearning =
    input.state === "LEARNING" && input.repetitions === 0 && input.lapses === 0;

  if (input.state === "LEARNING") {
    const steps = isInitialLearning
      ? settings.learningStepsMinutes
      : settings.relearningStepsMinutes;
    const currentStep = Math.min(input.learningStep, steps.length - 1);

    if (rating === "AGAIN") {
      return {
        state: "LEARNING",
        dueAt: addMinutes(reviewedAt, steps[0]!),
        intervalDays: input.intervalDays,
        easeFactor: input.easeFactor,
        repetitions: input.repetitions,
        lapses: input.lapses,
        learningStep: 0,
      };
    }

    if (rating === "HARD") {
      return {
        state: "LEARNING",
        dueAt: addMinutes(reviewedAt, Math.max(1, Math.round(steps[currentStep]! * 1.5))),
        intervalDays: input.intervalDays,
        easeFactor: input.easeFactor,
        repetitions: input.repetitions,
        lapses: input.lapses,
        learningStep: currentStep,
      };
    }

    if (rating === "GOOD" && currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      return {
        state: "LEARNING",
        dueAt: addMinutes(reviewedAt, steps[nextStep]!),
        intervalDays: input.intervalDays,
        easeFactor: input.easeFactor,
        repetitions: input.repetitions,
        lapses: input.lapses,
        learningStep: nextStep,
      };
    }

    const baseInterval = rating === "EASY"
      ? settings.easyIntervalDays
      : isInitialLearning
        ? settings.graduatingIntervalDays
        : Math.max(settings.minimumIntervalDays, input.intervalDays);
    const intervalDays = clampInterval(
      baseInterval * settings.intervalModifier,
      settings,
    );

    return {
      state: "REVIEW",
      dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
      intervalDays,
      easeFactor: rating === "EASY" ? clampEase(input.easeFactor + 0.15) : input.easeFactor,
      repetitions: input.repetitions + 1,
      lapses: input.lapses,
      learningStep: 0,
    };
  }

  if (rating === "AGAIN") {
    const intervalDays = clampInterval(
      input.intervalDays * settings.lapseIntervalMultiplier,
      settings,
    );

    return {
      state: "LEARNING",
      dueAt: addMinutes(reviewedAt, settings.relearningStepsMinutes[0]!),
      intervalDays,
      easeFactor: clampEase(input.easeFactor - 0.2),
      repetitions: 0,
      lapses: input.lapses + 1,
      learningStep: 0,
    };
  }

  if (rating === "HARD") {
    const intervalDays = clampInterval(
      Math.max(1, input.intervalDays) * settings.hardMultiplier * settings.intervalModifier,
      settings,
    );

    return {
      state: "REVIEW",
      dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
      intervalDays,
      easeFactor: clampEase(input.easeFactor - 0.15),
      repetitions: input.repetitions + 1,
      lapses: input.lapses,
      learningStep: 0,
    };
  }

  if (rating === "EASY") {
    const intervalDays = clampInterval(
      Math.max(settings.easyIntervalDays, input.intervalDays * input.easeFactor * settings.easyBonus) *
        settings.intervalModifier,
      settings,
    );

    return {
      state: "REVIEW",
      dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
      intervalDays,
      easeFactor: clampEase(input.easeFactor + 0.15),
      repetitions: input.repetitions + 1,
      lapses: input.lapses,
      learningStep: 0,
    };
  }

  const intervalDays = clampInterval(
    Math.max(1, input.intervalDays) * input.easeFactor * settings.intervalModifier,
    settings,
  );

  return {
    state: "REVIEW",
    dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
    intervalDays,
    easeFactor: clampEase(input.easeFactor),
    repetitions: input.repetitions + 1,
    lapses: input.lapses,
    learningStep: 0,
  };
}
