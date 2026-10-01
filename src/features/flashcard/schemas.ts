import { z } from "zod";

/**
 * Pengaturan flashcard, mengikuti deck options Anki.
 *
 * Penjadwalan disimpan per deck (`FlashcardDeckSubscription.config`), tampilan
 * per user (`FlashcardCollection.display`), keduanya JSONB karena tidak ada satu
 * pun setting yang perlu di-query. Skema ini satu-satunya gerbang validasinya —
 * jangan pernah membaca kolom itu tanpa parse.
 *
 * Kartu milik satu deck, jadi pengaturan deck tidak pernah bertabrakan: kata
 * yang ada di dua deck adalah dua kartu, masing-masing dijadwalkan dengan
 * pengaturan deck-nya dan dihitung ke batas harian deck-nya.
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
  "ascendingRetrievability",
  "descendingRetrievability",
  "random",
]);

export const InsertionOrderSchema = z.enum(["sequential", "random"]);
export const LeechActionSchema = z.enum(["suspend", "tagOnly"]);

// --- FSRS --------------------------------------------------------------------

// FSRS-6 memakai tepat 21 parameter. Tidak ada optimizer di sini (Anki
// melatihnya dengan gradient descent di Rust), jadi semua user memakai default.
export const FSRS_PARAMETER_COUNT = 21;

export const FsrsParametersSchema = z
  .array(z.number().finite())
  .length(FSRS_PARAMETER_COUNT, `FSRS-6 membutuhkan tepat ${FSRS_PARAMETER_COUNT} parameter.`);

export const FLASHCARD_DEFAULT_FSRS_PARAMETERS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;

// --- Pengaturan penjadwalan --------------------------------------------------

export const FlashcardConfigSchema = z.object({
  // Batas harian deck ini
  newCardsPerDay: z.number().int().min(0).max(9_999).default(20),
  maxReviewsPerDay: z.number().int().min(0).max(99_999).default(9_999),

  // Kartu baru
  learningSteps: learningSteps.default(["1m", "2h", "3h"]),
  insertionOrder: InsertionOrderSchema.default("sequential"),

  // Lapse
  relearningSteps: learningSteps.default(["1m", "1h"]),

  // Urutan tampil
  newCardGatherOrder: NewCardGatherOrderSchema.default("randomCards"),
  newCardSortOrder: NewCardSortOrderSchema.default("gather"),
  newReviewOrder: NewReviewOrderSchema.default("afterReviews"),
  interdayLearningReviewOrder: InterdayLearningReviewOrderSchema.default("beforeReviews"),
  reviewSortOrder: ReviewSortOrderSchema.default("descendingRetrievability"),

  // FSRS
  fsrsEnabled: z.boolean().default(true),
  desiredRetention: z.number().min(0.7).max(0.99).default(0.95),

  // Tidak ditampilkan di halaman pengaturan, tetapi tetap dipakai scheduler.
  // Nilainya default Anki.
  fsrsParameters: FsrsParametersSchema.default([...FLASHCARD_DEFAULT_FSRS_PARAMETERS]),
  newCardsIgnoreReviewLimit: z.boolean().default(false),
  maximumIntervalDays: z.number().int().min(1).max(36_500).default(36_500),
  leechThreshold: z.number().int().min(0).max(9_999).default(8),
  leechAction: LeechActionSchema.default("tagOnly"),
  // Hanya dipakai saat FSRS dimatikan (fallback SM-2).
  graduatingIntervalDays: z.number().int().min(1).max(9_999).default(1),
  easyIntervalDays: z.number().int().min(1).max(9_999).default(4),
  minimumIntervalDays: z.number().int().min(1).max(9_999).default(1),
  startingEase: z.number().min(1.31).max(5).default(2.5),
  easyBonus: z.number().min(1).max(5).default(1.3),
  intervalModifier: z.number().min(0.5).max(2).default(1),
  hardInterval: z.number().min(0.5).max(5).default(1.2),
  newInterval: z.number().min(0).max(1).default(0),
});

export type FlashcardConfig = z.infer<typeof FlashcardConfigSchema>;

export const FLASHCARD_DEFAULT_CONFIG: FlashcardConfig = FlashcardConfigSchema.parse({});

// --- Pengaturan tampilan -----------------------------------------------------

export const FLASHCARD_TEXT_SCALE = { min: 80, max: 160, step: 10 } as const;

export const FlashcardDisplaySchema = z.object({
  /** Ukuran teks kartu dalam persen. */
  textScale: z
    .number()
    .int()
    .min(FLASHCARD_TEXT_SCALE.min)
    .max(FLASHCARD_TEXT_SCALE.max)
    .default(100),
  /** Furigana langsung terlihat saat jawaban dibuka; bila mati, muncul saat diketuk. */
  showFuriganaOnBack: z.boolean().default(true),
});

export type FlashcardDisplay = z.infer<typeof FlashcardDisplaySchema>;

export const FLASHCARD_DEFAULT_DISPLAY: FlashcardDisplay = FlashcardDisplaySchema.parse({});

/**
 * Nilai tersimpan bisa berasal dari versi skema lama. Setiap field punya
 * default, jadi field baru terisi tanpa migration; field yang tidak valid lagi
 * (mis. pilihan yang sudah dihapus) diganti default-nya sendiri, bukan
 * menghapus seluruh pengaturan user.
 */
function parseLenient<T extends z.ZodObject>(schema: T, fallback: z.infer<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const source =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const repaired: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    const field = (fieldSchema as z.ZodType).safeParse(source[key]);
    if (field.success) repaired[key] = field.data;
  }

  const second = schema.safeParse(repaired);
  return second.success ? second.data : fallback;
}

export function parseFlashcardConfig(value: unknown): FlashcardConfig {
  return parseLenient(FlashcardConfigSchema, FLASHCARD_DEFAULT_CONFIG, value);
}

export function parseFlashcardDisplay(value: unknown): FlashcardDisplay {
  return parseLenient(FlashcardDisplaySchema, FLASHCARD_DEFAULT_DISPLAY, value);
}

// --- Input lain --------------------------------------------------------------

export const FlashcardRatingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export type FlashcardRatingInput = z.infer<typeof FlashcardRatingSchema>;

export const FlashcardDeckSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Deck tidak valid.")
  .max(60);

export const FlashcardVocabIdSchema = z.number().int().positive();
