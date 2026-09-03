import { z } from "zod";
import { FLASHCARD_NOTE_TYPE_KINDS } from "./note-types";

/**
 * Deck options, mengikuti Anki.
 *
 * Di Anki ini adalah "preset" yang dipakai bersama banyak deck, bukan setting
 * global per user. Disimpan sebagai JSONB (`FlashcardPreset.config`) karena
 * tidak ada satu pun setting di sini yang perlu di-query atau di-index,
 * sementara daftarnya akan terus bertambah. Skema ini adalah satu-satunya
 * gerbang validasinya — jangan pernah membaca `config` tanpa `.parse()`.
 */

// --- Learning steps ----------------------------------------------------------

// Format step: "10m" atau "1h" — hanya menit dan jam bulat.
//
// Anki sendiri menerima detik ("30s") dan step antar-hari ("1d"), tapi keduanya
// TIDAK bisa diteruskan ke ts-fsrs dengan hasil yang benar:
//
//   - `ConvertStepUnitToMinutes` menolak satuan detik dan MEMBULATKAN pecahan ke
//     bawah, sehingga "30s" (0.5m) menjadi 0 menit lalu seluruh array step
//     diabaikan diam-diam dan kartu langsung lulus ke review.
//   - Step >= 1 hari dikembalikan ts-fsrs sebagai `State.Review`, bukan state
//     learning, dan index step-nya tidak konsisten antar bentuk array. Kartu
//     jadi tidak bisa dibedakan dari kartu review biasa oleh queue gatherer.
//
// Karena itu batasnya ditegakkan di sini, bukan dibiarkan gagal diam-diam.
// Panduan FSRS sendiri menyarankan learning steps tetap pendek (< 1 hari).
const STEP_PATTERN = /^\d+[mh]$/;
const MINUTES_PER_DAY = 1_440;

function stepToMinutes(step: string) {
  const value = Number(step.slice(0, -1));
  return step.endsWith("h") ? value * 60 : value;
}

export const FlashcardStepSchema = z
  .string()
  .trim()
  .regex(STEP_PATTERN, "Format step harus menit atau jam bulat, mis. 10m atau 1h.")
  .refine((step) => stepToMinutes(step) >= 1, "Step minimal 1 menit.")
  .refine(
    (step) => stepToMinutes(step) < MINUTES_PER_DAY,
    "Step harus kurang dari 1 hari; penjadwalan lebih panjang diserahkan ke FSRS.",
  );

const learningSteps = z.array(FlashcardStepSchema).max(10);

// --- Display order (nilai mengikuti penamaan Anki) ---------------------------

export const NewCardGatherOrderSchema = z.enum([
  "deck",
  "deckThenRandomNotes",
  "ascendingPosition",
  "descendingPosition",
  "randomNotes",
  "randomCards",
]);

export const NewCardSortOrderSchema = z.enum([
  "templateThenGather",
  "gather",
  "cardTemplateThenRandom",
  "randomNoteThenTemplate",
  "random",
]);

export const NewReviewOrderSchema = z.enum(["mix", "afterReviews", "beforeReviews"]);

export const InterdayLearningReviewOrderSchema = z.enum([
  "mix",
  "afterReviews",
  "beforeReviews",
]);

export const ReviewSortOrderSchema = z.enum([
  "dueDateThenRandom",
  "dueDateThenDeck",
  "deckThenDueDate",
  "ascendingIntervals",
  "descendingIntervals",
  "ascendingEase",
  "descendingEase",
  "relativeOverdueness",
]);

export const LeechActionSchema = z.enum(["suspend", "tagOnly"]);
export const InsertionOrderSchema = z.enum(["sequential", "random"]);
export const AnswerActionSchema = z.enum([
  "buryCard",
  "answerAgain",
  "answerGood",
  "answerHard",
  "showReminder",
]);

// --- FSRS --------------------------------------------------------------------

// FSRS-6 memakai tepat 21 parameter. Kita tidak menyediakan optimizer (Anki
// melatihnya dengan gradient descent di Rust), jadi user memakai default atau
// mem-paste parameter hasil optimasi dari Anki mereka sendiri.
export const FSRS_PARAMETER_COUNT = 21;

export const FsrsParametersSchema = z
  .array(z.number().finite())
  .length(FSRS_PARAMETER_COUNT, `FSRS-6 membutuhkan tepat ${FSRS_PARAMETER_COUNT} parameter.`);

export const FLASHCARD_DEFAULT_FSRS_PARAMETERS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;

// --- Preset ------------------------------------------------------------------

export const FlashcardPresetConfigSchema = z.object({
  // Daily limits
  newCardsPerDay: z.number().int().min(0).max(9_999).default(20),
  maxReviewsPerDay: z.number().int().min(0).max(99_999).default(200),
  newCardsIgnoreReviewLimit: z.boolean().default(false),
  limitsStartFromTop: z.boolean().default(false),

  // New cards
  learningSteps: learningSteps.default(["1m", "10m"]),
  graduatingIntervalDays: z.number().int().min(1).max(9_999).default(1),
  easyIntervalDays: z.number().int().min(1).max(9_999).default(4),
  insertionOrder: InsertionOrderSchema.default("sequential"),

  // Lapses
  relearningSteps: learningSteps.default(["10m"]),
  minimumIntervalDays: z.number().int().min(1).max(9_999).default(1),
  leechThreshold: z.number().int().min(0).max(9_999).default(8),
  leechAction: LeechActionSchema.default("tagOnly"),

  // Burying
  buryNewSiblings: z.boolean().default(false),
  buryReviewSiblings: z.boolean().default(false),
  buryInterdayLearningSiblings: z.boolean().default(false),

  // FSRS
  fsrsEnabled: z.boolean().default(true),
  desiredRetention: z.number().min(0.7).max(0.99).default(0.9),
  fsrsParameters: FsrsParametersSchema.default([...FLASHCARD_DEFAULT_FSRS_PARAMETERS]),
  rescheduleCardsOnChange: z.boolean().default(false),
  historicalRetention: z.number().min(0.7).max(0.99).default(0.9),

  // Display order
  newCardGatherOrder: NewCardGatherOrderSchema.default("deck"),
  newCardSortOrder: NewCardSortOrderSchema.default("templateThenGather"),
  newReviewOrder: NewReviewOrderSchema.default("mix"),
  interdayLearningReviewOrder: InterdayLearningReviewOrderSchema.default("mix"),
  reviewSortOrder: ReviewSortOrderSchema.default("dueDateThenRandom"),

  // Timers
  maximumAnswerSeconds: z.number().int().min(1).max(3_600).default(60),
  showOnScreenTimer: z.boolean().default(false),
  stopTimerOnAnswer: z.boolean().default(false),

  // Auto advance (0 = mati)
  secondsToShowQuestion: z.number().min(0).max(600).default(0),
  secondsToShowAnswer: z.number().min(0).max(600).default(0),
  answerAction: AnswerActionSchema.default("buryCard"),

  // Audio
  disableAutoPlayAudio: z.boolean().default(false),
  skipQuestionWhenReplayingAnswer: z.boolean().default(false),

  // Advanced — hanya dipakai saat fsrsEnabled = false (fallback SM-2).
  maximumIntervalDays: z.number().int().min(1).max(36_500).default(36_500),
  startingEase: z.number().min(1.31).max(5).default(2.5),
  easyBonus: z.number().min(1).max(5).default(1.3),
  intervalModifier: z.number().min(0.5).max(2).default(1),
  hardInterval: z.number().min(0.5).max(5).default(1.2),
  newInterval: z.number().min(0).max(1).default(0),
});

export type FlashcardPresetConfig = z.infer<typeof FlashcardPresetConfigSchema>;

/** Nilai default lengkap; dipakai saat membuat preset "Default" untuk user baru. */
export const FLASHCARD_DEFAULT_PRESET_CONFIG: FlashcardPresetConfig =
  FlashcardPresetConfigSchema.parse({});

export const FLASHCARD_DEFAULT_PRESET_NAME = "Default";

/**
 * Config yang tersimpan bisa berasal dari versi skema lama. Karena setiap field
 * punya default, parse akan mengisi field baru tanpa perlu migration data.
 */
export function parsePresetConfig(value: unknown): FlashcardPresetConfig {
  const result = FlashcardPresetConfigSchema.safeParse(value);
  return result.success ? result.data : FLASHCARD_DEFAULT_PRESET_CONFIG;
}

// --- Input lain --------------------------------------------------------------

export const FlashcardRatingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export type FlashcardRatingInput = z.infer<typeof FlashcardRatingSchema>;

export const FlashcardNoteTypeKindSchema = z.enum(
  FLASHCARD_NOTE_TYPE_KINDS as [string, ...string[]],
);

// Nama deck hierarkis Anki: segmen dipisah "::", tiap segmen tidak boleh kosong.
export const FlashcardDeckNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value.split("::").every((segment) => segment.trim().length > 0),
    "Setiap bagian nama deck (dipisah ::) tidak boleh kosong.",
  );

export const FlashcardPresetNameSchema = z.string().trim().min(1).max(120);
