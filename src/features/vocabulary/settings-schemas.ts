import { z } from "zod";
import { parseReviewSteps } from "./lib/settings";

const ReviewStepsSchema = z
  .string()
  .trim()
  .min(1, "Minimal satu langkah diperlukan.")
  .max(40, "Format langkah terlalu panjang.")
  .refine(
    (value) => parseReviewSteps(value) !== null,
    "Gunakan 1-4 langkah berurutan, misalnya 1m 10m 1h.",
  );

const boundedInteger = (minimum: number, maximum: number) =>
  z
    .number({ error: "Nilai wajib berupa angka." })
    .int("Gunakan angka bulat.")
    .min(minimum, `Nilai minimal ${minimum}.`)
    .max(maximum, `Nilai maksimal ${maximum}.`);

export const FlashcardSettingsSchema = z
  .object({
    newCardsPerDay: boundedInteger(0, 100),
    maxReviewsPerDay: boundedInteger(0, 1000),
    learningSteps: ReviewStepsSchema,
    graduatingIntervalDays: boundedInteger(1, 36500),
    easyIntervalDays: boundedInteger(1, 36500),
    startingEasePercent: boundedInteger(130, 500),
    relearningSteps: ReviewStepsSchema,
    lapseIntervalPercent: boundedInteger(0, 100),
    minimumIntervalDays: boundedInteger(1, 36500),
    maximumIntervalDays: boundedInteger(1, 36500),
    intervalModifierPercent: boundedInteger(50, 200),
    easyBonusPercent: boundedInteger(100, 300),
    hardMultiplierPercent: boundedInteger(100, 200),
  })
  .superRefine((value, context) => {
    if (value.maximumIntervalDays < value.minimumIntervalDays) {
      context.addIssue({
        code: "custom",
        path: ["maximumIntervalDays"],
        message: "Interval maksimum harus lebih besar dari interval minimum.",
      });
    }

    if (value.graduatingIntervalDays > value.maximumIntervalDays) {
      context.addIssue({
        code: "custom",
        path: ["graduatingIntervalDays"],
        message: "Interval lulus tidak boleh melewati interval maksimum.",
      });
    }

    if (value.easyIntervalDays > value.maximumIntervalDays) {
      context.addIssue({
        code: "custom",
        path: ["easyIntervalDays"],
        message: "Interval Easy tidak boleh melewati interval maksimum.",
      });
    }
  });

export type FlashcardSettingsInput = z.infer<typeof FlashcardSettingsSchema>;
