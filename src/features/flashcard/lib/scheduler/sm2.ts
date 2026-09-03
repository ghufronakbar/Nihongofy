import type { FlashcardCardType } from "@prisma/client";
import type { FlashcardPresetConfig } from "../../schemas";
import { isIntradayDue, type FlashcardDayContext } from "./day";
import type { SchedulerCardState, SchedulerInput, SchedulerResult } from "./types";

/**
 * Fallback SM-2, dipakai hanya saat `config.fsrsEnabled === false`.
 *
 * Ini meniru scheduler lama Anki (sebelum FSRS): ease factor, easy bonus,
 * interval modifier, dan hard interval. Setting-setting di bagian "Advanced"
 * deck options hanya berpengaruh di jalur ini.
 */

const MINUTE_IN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MINIMUM_EASE = 1.3;

/** Step Anki: "30s" | "10m" | "1h" | "3d" -> milidetik. */
export function parseStepToMs(step: string): number {
  const match = /^(\d+(?:\.\d+)?)(s|m|h|d)$/.exec(step.trim());
  if (!match) return 10 * MINUTE_IN_MS;

  const value = Number(match[1]);
  switch (match[2]) {
    case "s":
      return value * 1_000;
    case "m":
      return value * MINUTE_IN_MS;
    case "h":
      return value * 60 * MINUTE_IN_MS;
    default:
      return value * DAY_IN_MS;
  }
}

function clampEase(value: number) {
  return Math.max(MINIMUM_EASE, Math.round(value * 100) / 100);
}

function clampInterval(days: number, config: FlashcardPresetConfig) {
  return Math.min(config.maximumIntervalDays, Math.max(1, Math.round(days)));
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * DAY_IN_MS);
}

function resolveQueue(
  type: FlashcardCardType,
  due: Date,
  now: Date,
  day: FlashcardDayContext,
) {
  if (type === "REVIEW") return "REVIEW" as const;
  if (type === "NEW") return "NEW" as const;
  return isIntradayDue(due, now, day) ? ("LEARNING" as const) : ("DAY_LEARN" as const);
}

function crossedLeechThreshold(lapses: number, threshold: number) {
  if (threshold <= 0 || lapses < threshold) return false;
  const step = Math.max(1, Math.floor(threshold / 2));
  return (lapses - threshold) % step === 0;
}

/** Hari keterlambatan review; Anki memberi bonus interval untuk kartu yang telat. */
function overdueDays(card: SchedulerCardState, now: Date) {
  if (card.type !== "REVIEW") return 0;
  return Math.max(0, Math.floor((now.getTime() - card.due.getTime()) / DAY_IN_MS));
}

function graduate(
  input: SchedulerInput,
  ease: number,
  intervalDays: number,
): SchedulerResult {
  const { card, now, config, day } = input;
  const clamped = clampInterval(intervalDays * config.intervalModifier, config);
  const due = addDays(now, clamped);

  return {
    card: {
      ...card,
      type: "REVIEW",
      queue: resolveQueue("REVIEW", due, now, day),
      due,
      intervalDays: clamped,
      reps: card.reps + 1,
      learningStep: 0,
      easeFactor: ease,
      stability: null,
      difficulty: null,
      desiredRetention: null,
      lastReviewedAt: now,
    },
    revlog: {
      kind: card.type === "RELEARNING" ? "RELEARN" : "LEARN",
      intervalDays: clamped,
      lastIntervalDays: card.intervalDays,
      stability: null,
      difficulty: null,
      easeFactor: ease,
    },
    becameLeech: false,
  };
}

function stayInSteps(
  input: SchedulerInput,
  steps: string[],
  stepIndex: number,
  delayMs: number,
): SchedulerResult {
  const { card, now, day } = input;
  const due = new Date(now.getTime() + delayMs);
  const type: FlashcardCardType = card.type === "RELEARNING" ? "RELEARNING" : "LEARNING";

  return {
    card: {
      ...card,
      type,
      queue: resolveQueue(type, due, now, day),
      due,
      learningStep: Math.min(stepIndex, Math.max(0, steps.length - 1)),
      reps: card.reps + 1,
      easeFactor: card.easeFactor ?? input.config.startingEase,
      stability: null,
      difficulty: null,
      desiredRetention: null,
      lastReviewedAt: now,
    },
    revlog: {
      kind: type === "RELEARNING" ? "RELEARN" : "LEARN",
      intervalDays: 0,
      lastIntervalDays: card.intervalDays,
      stability: null,
      difficulty: null,
      easeFactor: card.easeFactor ?? input.config.startingEase,
    },
    becameLeech: false,
  };
}

export function scheduleWithSm2(input: SchedulerInput): SchedulerResult {
  const { card, rating, now, config, day } = input;
  const ease = card.easeFactor ?? config.startingEase;

  // --- Learning / relearning -------------------------------------------------
  if (card.type !== "REVIEW") {
    const isRelearning = card.type === "RELEARNING";
    const steps = isRelearning ? config.relearningSteps : config.learningSteps;

    if (steps.length === 0) {
      // Tanpa step, kartu langsung lulus (perilaku Anki saat steps dikosongkan).
      return graduate(
        input,
        rating === "EASY" ? clampEase(ease + 0.15) : ease,
        rating === "EASY" ? config.easyIntervalDays : config.graduatingIntervalDays,
      );
    }

    const current = Math.min(card.learningStep, steps.length - 1);

    if (rating === "EASY") {
      return graduate(input, clampEase(ease + 0.15), config.easyIntervalDays);
    }

    if (rating === "AGAIN") {
      return stayInSteps(input, steps, 0, parseStepToMs(steps[0]!));
    }

    if (rating === "HARD") {
      // Anki: rata-rata step sekarang dan berikutnya; kalau ini step terakhir
      // (atau satu-satunya), step sekarang dikali 1.5.
      const currentMs = parseStepToMs(steps[current]!);
      const nextStep = steps[current + 1];
      const delay = nextStep
        ? (currentMs + parseStepToMs(nextStep)) / 2
        : currentMs * 1.5;
      return stayInSteps(input, steps, current, delay);
    }

    // GOOD
    const next = current + 1;
    if (next < steps.length) {
      return stayInSteps(input, steps, next, parseStepToMs(steps[next]!));
    }

    return graduate(
      input,
      ease,
      isRelearning
        ? Math.max(config.minimumIntervalDays, card.intervalDays)
        : config.graduatingIntervalDays,
    );
  }

  // --- Review ----------------------------------------------------------------
  if (rating === "AGAIN") {
    const lapses = card.lapses + 1;
    const nextEase = clampEase(ease - 0.2);
    const lapsedInterval = Math.max(
      config.minimumIntervalDays,
      Math.round(card.intervalDays * config.newInterval),
    );

    const steps = config.relearningSteps;
    const due =
      steps.length > 0
        ? new Date(now.getTime() + parseStepToMs(steps[0]!))
        : addDays(now, lapsedInterval);
    const type: FlashcardCardType = steps.length > 0 ? "RELEARNING" : "REVIEW";

    return {
      card: {
        ...card,
        type,
        queue: resolveQueue(type, due, now, day),
        due,
        intervalDays: lapsedInterval,
        reps: card.reps + 1,
        lapses,
        learningStep: 0,
        easeFactor: nextEase,
        stability: null,
        difficulty: null,
        desiredRetention: null,
        lastReviewedAt: now,
      },
      revlog: {
        kind: "REVIEW",
        intervalDays: lapsedInterval,
        lastIntervalDays: card.intervalDays,
        stability: null,
        difficulty: null,
        easeFactor: nextEase,
      },
      becameLeech: crossedLeechThreshold(lapses, config.leechThreshold),
    };
  }

  const late = overdueDays(card, now);
  const current = Math.max(1, card.intervalDays);

  let nextEase: number;
  let rawInterval: number;

  if (rating === "HARD") {
    nextEase = clampEase(ease - 0.15);
    rawInterval = current * config.hardInterval;
  } else if (rating === "GOOD") {
    nextEase = ease;
    rawInterval = (current + late / 2) * ease;
  } else {
    nextEase = clampEase(ease + 0.15);
    rawInterval = (current + late) * ease * config.easyBonus;
  }

  // Anki menjamin interval selalu bertambah minimal satu hari.
  const intervalDays = Math.max(
    current + 1,
    clampInterval(rawInterval * config.intervalModifier, config),
  );
  const clamped = Math.min(config.maximumIntervalDays, intervalDays);
  const due = addDays(now, clamped);

  return {
    card: {
      ...card,
      type: "REVIEW",
      queue: "REVIEW",
      due,
      intervalDays: clamped,
      reps: card.reps + 1,
      learningStep: 0,
      easeFactor: nextEase,
      stability: null,
      difficulty: null,
      desiredRetention: null,
      lastReviewedAt: now,
    },
    revlog: {
      kind: "REVIEW",
      intervalDays: clamped,
      lastIntervalDays: card.intervalDays,
      stability: null,
      difficulty: null,
      easeFactor: nextEase,
    },
    becameLeech: false,
  };
}
