export type FlashcardSchedulerSettings = {
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  learningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  startingEaseFactor: number;
  relearningStepsMinutes: number[];
  lapseIntervalMultiplier: number;
  minimumIntervalDays: number;
  maximumIntervalDays: number;
  intervalModifier: number;
  easyBonus: number;
  hardMultiplier: number;
};

export const DEFAULT_FLASHCARD_SETTINGS: FlashcardSchedulerSettings = {
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEaseFactor: 2.5,
  relearningStepsMinutes: [10],
  lapseIntervalMultiplier: 0,
  minimumIntervalDays: 1,
  maximumIntervalDays: 36500,
  intervalModifier: 1,
  easyBonus: 1.3,
  hardMultiplier: 1.2,
};

const STEP_PATTERN = /^(\d+)(m|h|d)$/i;
const MAX_STEP_MINUTES = 30 * 24 * 60;

export function parseReviewSteps(value: string): number[] | null {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 4) return null;

  const minutes = tokens.map((token) => {
    const match = STEP_PATTERN.exec(token);
    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    const multiplier = unit === "d" ? 24 * 60 : unit === "h" ? 60 : 1;
    const result = amount * multiplier;

    if (!Number.isSafeInteger(result) || result < 1 || result > MAX_STEP_MINUTES) {
      return null;
    }

    return result;
  });

  if (minutes.some((value) => value === null)) return null;

  const parsed = minutes as number[];
  if (parsed.some((value, index) => index > 0 && value <= parsed[index - 1]!)) {
    return null;
  }

  return parsed;
}

export function formatReviewSteps(minutes: number[]) {
  return minutes
    .map((value) => {
      if (value % (24 * 60) === 0) return `${value / (24 * 60)}d`;
      if (value % 60 === 0) return `${value / 60}h`;
      return `${value}m`;
    })
    .join(" ");
}

export function getJakartaDayStart(date: Date) {
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const jakartaDate = new Date(date.getTime() + jakartaOffsetMs);

  return new Date(
    Date.UTC(
      jakartaDate.getUTCFullYear(),
      jakartaDate.getUTCMonth(),
      jakartaDate.getUTCDate(),
    ) - jakartaOffsetMs,
  );
}
