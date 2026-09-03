import { z } from "zod";
import {
  FLASHCARD_DEFAULT_FSRS_PARAMETERS,
  FSRS_PARAMETER_COUNT,
  FlashcardPresetConfigSchema,
  FlashcardStepSchema,
  type FlashcardPresetConfig,
} from "./schemas";

/**
 * Jembatan antara form dan `FlashcardPresetConfig`.
 *
 * Tiga field disimpan sebagai struktur tapi diketik sebagai teks di form, persis
 * seperti Anki: learning steps, relearning steps, dan 21 parameter FSRS.
 * Konversinya dipisah ke sini supaya bisa diuji tanpa merender form.
 */

// --- Steps -------------------------------------------------------------------

/** "1m 10m" -> ["1m", "10m"]. Koma dan spasi berlebih ditoleransi. */
export function parseSteps(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

export function formatSteps(steps: readonly string[]): string {
  return steps.join(" ");
}

const StepsFieldSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const steps = parseSteps(value);
    if (steps.length > 10) {
      ctx.addIssue({ code: "custom", message: "Maksimal 10 step." });
      return;
    }
    for (const step of steps) {
      const result = FlashcardStepSchema.safeParse(step);
      if (!result.success) {
        ctx.addIssue({
          code: "custom",
          message: `"${step}": ${result.error.issues[0]?.message ?? "step tidak valid"}`,
        });
        return;
      }
    }
  });

// --- Parameter FSRS ----------------------------------------------------------

export function parseFsrsParameters(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map(Number);
}

export function formatFsrsParameters(parameters: readonly number[]): string {
  return parameters.join(", ");
}

const FsrsParametersFieldSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const parameters = parseFsrsParameters(value);
    if (parameters.length !== FSRS_PARAMETER_COUNT) {
      ctx.addIssue({
        code: "custom",
        message: `FSRS-6 butuh tepat ${FSRS_PARAMETER_COUNT} angka, ditemukan ${parameters.length}.`,
      });
      return;
    }
    if (parameters.some((value) => !Number.isFinite(value))) {
      ctx.addIssue({ code: "custom", message: "Semua parameter harus berupa angka." });
    }
  });

// --- Skema form --------------------------------------------------------------

const percent = z.coerce.number().min(70).max(99);
const count = (max: number) => z.coerce.number().int().min(0).max(max);

export const PresetFormSchema = z.object({
  name: z.string().trim().min(1).max(120),

  newCardsPerDay: count(9_999),
  maxReviewsPerDay: count(99_999),
  newCardsIgnoreReviewLimit: z.boolean(),
  limitsStartFromTop: z.boolean(),

  learningSteps: StepsFieldSchema,
  graduatingIntervalDays: z.coerce.number().int().min(1).max(9_999),
  easyIntervalDays: z.coerce.number().int().min(1).max(9_999),
  insertionOrder: z.enum(["sequential", "random"]),

  relearningSteps: StepsFieldSchema,
  minimumIntervalDays: z.coerce.number().int().min(1).max(9_999),
  leechThreshold: count(9_999),
  leechAction: z.enum(["suspend", "tagOnly"]),

  buryNewSiblings: z.boolean(),
  buryReviewSiblings: z.boolean(),
  buryInterdayLearningSiblings: z.boolean(),

  fsrsEnabled: z.boolean(),
  /** Ditampilkan sebagai persen supaya lebih mudah dibaca daripada 0.90. */
  desiredRetentionPercent: percent,
  fsrsParameters: FsrsParametersFieldSchema,
  rescheduleCardsOnChange: z.boolean(),
  historicalRetentionPercent: percent,

  newCardGatherOrder: z.enum([
    "deck",
    "deckThenRandomNotes",
    "ascendingPosition",
    "descendingPosition",
    "randomNotes",
    "randomCards",
  ]),
  newCardSortOrder: z.enum([
    "templateThenGather",
    "gather",
    "cardTemplateThenRandom",
    "randomNoteThenTemplate",
    "random",
  ]),
  newReviewOrder: z.enum(["mix", "afterReviews", "beforeReviews"]),
  interdayLearningReviewOrder: z.enum(["mix", "afterReviews", "beforeReviews"]),
  reviewSortOrder: z.enum([
    "dueDateThenRandom",
    "dueDateThenDeck",
    "deckThenDueDate",
    "ascendingIntervals",
    "descendingIntervals",
    "ascendingEase",
    "descendingEase",
    "relativeOverdueness",
  ]),

  maximumAnswerSeconds: z.coerce.number().int().min(1).max(3_600),
  showOnScreenTimer: z.boolean(),
  stopTimerOnAnswer: z.boolean(),

  secondsToShowQuestion: z.coerce.number().min(0).max(600),
  secondsToShowAnswer: z.coerce.number().min(0).max(600),
  answerAction: z.enum([
    "buryCard",
    "answerAgain",
    "answerGood",
    "answerHard",
    "showReminder",
  ]),

  disableAutoPlayAudio: z.boolean(),
  skipQuestionWhenReplayingAnswer: z.boolean(),

  maximumIntervalDays: z.coerce.number().int().min(1).max(36_500),
  startingEase: z.coerce.number().min(1.31).max(5),
  easyBonus: z.coerce.number().min(1).max(5),
  intervalModifier: z.coerce.number().min(0.5).max(2),
  hardInterval: z.coerce.number().min(0.5).max(5),
  newInterval: z.coerce.number().min(0).max(1),
});

export type PresetFormValues = z.input<typeof PresetFormSchema>;
export type PresetFormOutput = z.output<typeof PresetFormSchema>;

export function configToForm(name: string, config: FlashcardPresetConfig): PresetFormValues {
  return {
    name,
    newCardsPerDay: config.newCardsPerDay,
    maxReviewsPerDay: config.maxReviewsPerDay,
    newCardsIgnoreReviewLimit: config.newCardsIgnoreReviewLimit,
    limitsStartFromTop: config.limitsStartFromTop,

    learningSteps: formatSteps(config.learningSteps),
    graduatingIntervalDays: config.graduatingIntervalDays,
    easyIntervalDays: config.easyIntervalDays,
    insertionOrder: config.insertionOrder,

    relearningSteps: formatSteps(config.relearningSteps),
    minimumIntervalDays: config.minimumIntervalDays,
    leechThreshold: config.leechThreshold,
    leechAction: config.leechAction,

    buryNewSiblings: config.buryNewSiblings,
    buryReviewSiblings: config.buryReviewSiblings,
    buryInterdayLearningSiblings: config.buryInterdayLearningSiblings,

    fsrsEnabled: config.fsrsEnabled,
    desiredRetentionPercent: Math.round(config.desiredRetention * 100),
    fsrsParameters: formatFsrsParameters(config.fsrsParameters),
    rescheduleCardsOnChange: config.rescheduleCardsOnChange,
    historicalRetentionPercent: Math.round(config.historicalRetention * 100),

    newCardGatherOrder: config.newCardGatherOrder,
    newCardSortOrder: config.newCardSortOrder,
    newReviewOrder: config.newReviewOrder,
    interdayLearningReviewOrder: config.interdayLearningReviewOrder,
    reviewSortOrder: config.reviewSortOrder,

    maximumAnswerSeconds: config.maximumAnswerSeconds,
    showOnScreenTimer: config.showOnScreenTimer,
    stopTimerOnAnswer: config.stopTimerOnAnswer,

    secondsToShowQuestion: config.secondsToShowQuestion,
    secondsToShowAnswer: config.secondsToShowAnswer,
    answerAction: config.answerAction,

    disableAutoPlayAudio: config.disableAutoPlayAudio,
    skipQuestionWhenReplayingAnswer: config.skipQuestionWhenReplayingAnswer,

    maximumIntervalDays: config.maximumIntervalDays,
    startingEase: config.startingEase,
    easyBonus: config.easyBonus,
    intervalModifier: config.intervalModifier,
    hardInterval: config.hardInterval,
    newInterval: config.newInterval,
  };
}

export function formToConfig(values: PresetFormOutput): FlashcardPresetConfig {
  return FlashcardPresetConfigSchema.parse({
    newCardsPerDay: values.newCardsPerDay,
    maxReviewsPerDay: values.maxReviewsPerDay,
    newCardsIgnoreReviewLimit: values.newCardsIgnoreReviewLimit,
    limitsStartFromTop: values.limitsStartFromTop,

    learningSteps: parseSteps(values.learningSteps),
    graduatingIntervalDays: values.graduatingIntervalDays,
    easyIntervalDays: values.easyIntervalDays,
    insertionOrder: values.insertionOrder,

    relearningSteps: parseSteps(values.relearningSteps),
    minimumIntervalDays: values.minimumIntervalDays,
    leechThreshold: values.leechThreshold,
    leechAction: values.leechAction,

    buryNewSiblings: values.buryNewSiblings,
    buryReviewSiblings: values.buryReviewSiblings,
    buryInterdayLearningSiblings: values.buryInterdayLearningSiblings,

    fsrsEnabled: values.fsrsEnabled,
    desiredRetention: values.desiredRetentionPercent / 100,
    fsrsParameters: parseFsrsParameters(values.fsrsParameters),
    rescheduleCardsOnChange: values.rescheduleCardsOnChange,
    historicalRetention: values.historicalRetentionPercent / 100,

    newCardGatherOrder: values.newCardGatherOrder,
    newCardSortOrder: values.newCardSortOrder,
    newReviewOrder: values.newReviewOrder,
    interdayLearningReviewOrder: values.interdayLearningReviewOrder,
    reviewSortOrder: values.reviewSortOrder,

    maximumAnswerSeconds: values.maximumAnswerSeconds,
    showOnScreenTimer: values.showOnScreenTimer,
    stopTimerOnAnswer: values.stopTimerOnAnswer,

    secondsToShowQuestion: values.secondsToShowQuestion,
    secondsToShowAnswer: values.secondsToShowAnswer,
    answerAction: values.answerAction,

    disableAutoPlayAudio: values.disableAutoPlayAudio,
    skipQuestionWhenReplayingAnswer: values.skipQuestionWhenReplayingAnswer,

    maximumIntervalDays: values.maximumIntervalDays,
    startingEase: values.startingEase,
    easyBonus: values.easyBonus,
    intervalModifier: values.intervalModifier,
    hardInterval: values.hardInterval,
    newInterval: values.newInterval,
  });
}

export const FSRS_DEFAULT_PARAMETERS_TEXT = formatFsrsParameters([
  ...FLASHCARD_DEFAULT_FSRS_PARAMETERS,
]);
