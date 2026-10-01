import { z } from "zod";
import {
  FLASHCARD_DEFAULT_CONFIG,
  FLASHCARD_DEFAULT_DISPLAY,
  FLASHCARD_TEXT_SCALE,
  FlashcardConfigSchema,
  FlashcardDisplaySchema,
  FlashcardStepSchema,
  InsertionOrderSchema,
  InterdayLearningReviewOrderSchema,
  NewCardGatherOrderSchema,
  NewCardSortOrderSchema,
  NewReviewOrderSchema,
  ReviewSortOrderSchema,
  type FlashcardConfig,
  type FlashcardDisplay,
} from "./schemas";

/**
 * Jembatan antara halaman pengaturan dan `FlashcardConfig`/`FlashcardDisplay`.
 *
 * Learning steps diketik sebagai teks seperti di Anki ("1m 2h 3h") dan desired
 * retention sebagai persen. Konversinya dipisah ke sini supaya bisa diuji tanpa
 * merender form. Field config yang tidak ada di form (parameter FSRS, setting
 * SM-2, dsb.) dipertahankan dari nilai tersimpan.
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

// --- Skema form --------------------------------------------------------------

const count = (max: number) => z.coerce.number().int().min(0).max(max);

export const SettingsFormSchema = z.object({
  textScale: z.coerce.number().int().min(FLASHCARD_TEXT_SCALE.min).max(FLASHCARD_TEXT_SCALE.max),
  showFuriganaOnBack: z.boolean(),

  newCardsPerDay: count(9_999),
  maxReviewsPerDay: count(99_999),

  learningSteps: StepsFieldSchema,
  insertionOrder: InsertionOrderSchema,

  relearningSteps: StepsFieldSchema,

  newCardGatherOrder: NewCardGatherOrderSchema,
  newCardSortOrder: NewCardSortOrderSchema,
  newReviewOrder: NewReviewOrderSchema,
  interdayLearningReviewOrder: InterdayLearningReviewOrderSchema,
  reviewSortOrder: ReviewSortOrderSchema,

  fsrsEnabled: z.boolean(),
  /** Ditampilkan sebagai persen supaya lebih mudah dibaca daripada 0.95. */
  desiredRetentionPercent: z.coerce.number().int().min(70).max(99),
});

export type SettingsFormValues = z.input<typeof SettingsFormSchema>;
export type SettingsFormOutput = z.output<typeof SettingsFormSchema>;
export type SettingsFieldName = keyof SettingsFormOutput;

export function settingsToForm(config: FlashcardConfig, display: FlashcardDisplay): SettingsFormOutput {
  return {
    textScale: display.textScale,
    showFuriganaOnBack: display.showFuriganaOnBack,
    newCardsPerDay: config.newCardsPerDay,
    maxReviewsPerDay: config.maxReviewsPerDay,
    learningSteps: formatSteps(config.learningSteps),
    insertionOrder: config.insertionOrder,
    relearningSteps: formatSteps(config.relearningSteps),
    newCardGatherOrder: config.newCardGatherOrder,
    newCardSortOrder: config.newCardSortOrder,
    newReviewOrder: config.newReviewOrder,
    interdayLearningReviewOrder: config.interdayLearningReviewOrder,
    reviewSortOrder: config.reviewSortOrder,
    fsrsEnabled: config.fsrsEnabled,
    desiredRetentionPercent: Math.round(config.desiredRetention * 100),
  };
}

export function formToSettings(
  values: SettingsFormOutput,
  base: FlashcardConfig,
): { config: FlashcardConfig; display: FlashcardDisplay } {
  return {
    config: FlashcardConfigSchema.parse({
      ...base,
      newCardsPerDay: values.newCardsPerDay,
      maxReviewsPerDay: values.maxReviewsPerDay,
      learningSteps: parseSteps(values.learningSteps),
      insertionOrder: values.insertionOrder,
      relearningSteps: parseSteps(values.relearningSteps),
      newCardGatherOrder: values.newCardGatherOrder,
      newCardSortOrder: values.newCardSortOrder,
      newReviewOrder: values.newReviewOrder,
      interdayLearningReviewOrder: values.interdayLearningReviewOrder,
      reviewSortOrder: values.reviewSortOrder,
      fsrsEnabled: values.fsrsEnabled,
      desiredRetention: values.desiredRetentionPercent / 100,
    }),
    display: FlashcardDisplaySchema.parse({
      textScale: values.textScale,
      showFuriganaOnBack: values.showFuriganaOnBack,
    }),
  };
}

/** Nilai bawaan tiap field, dipakai tombol reset per field dan "kembalikan semua". */
export const SETTINGS_FORM_DEFAULTS: SettingsFormOutput = settingsToForm(
  FLASHCARD_DEFAULT_CONFIG,
  FLASHCARD_DEFAULT_DISPLAY,
);

// --- Label pilihan -----------------------------------------------------------

type Option<T extends string> = { value: T; label: string };

export const INSERTION_ORDER_OPTIONS: Option<z.infer<typeof InsertionOrderSchema>>[] = [
  { value: "sequential", label: "Berurutan (kata awal lebih dulu)" },
  { value: "random", label: "Acak" },
];

export const NEW_CARD_GATHER_OPTIONS: Option<z.infer<typeof NewCardGatherOrderSchema>>[] = [
  { value: "deck", label: "Deck" },
  { value: "deckThenRandomNotes", label: "Deck, lalu note acak" },
  { value: "ascendingPosition", label: "Posisi menaik" },
  { value: "descendingPosition", label: "Posisi menurun" },
  { value: "randomNotes", label: "Note acak" },
  { value: "randomCards", label: "Kartu acak" },
];

export const NEW_CARD_SORT_OPTIONS: Option<z.infer<typeof NewCardSortOrderSchema>>[] = [
  { value: "templateThenGather", label: "Tipe kartu, lalu urutan ambil" },
  { value: "gather", label: "Urutan ambil" },
  { value: "cardTemplateThenRandom", label: "Tipe kartu, lalu acak" },
  { value: "randomNoteThenTemplate", label: "Note acak, lalu tipe kartu" },
  { value: "random", label: "Acak" },
];

export const NEW_REVIEW_ORDER_OPTIONS: Option<z.infer<typeof NewReviewOrderSchema>>[] = [
  { value: "mix", label: "Dicampur dengan review" },
  { value: "afterReviews", label: "Setelah review" },
  { value: "beforeReviews", label: "Sebelum review" },
];

export const INTERDAY_ORDER_OPTIONS: Option<z.infer<typeof InterdayLearningReviewOrderSchema>>[] = [
  { value: "mix", label: "Dicampur dengan review" },
  { value: "afterReviews", label: "Setelah review" },
  { value: "beforeReviews", label: "Sebelum review" },
];

export const REVIEW_SORT_OPTIONS: Option<z.infer<typeof ReviewSortOrderSchema>>[] = [
  { value: "dueDateThenRandom", label: "Tanggal jatuh tempo, lalu acak" },
  { value: "dueDateThenDeck", label: "Tanggal jatuh tempo, lalu deck" },
  { value: "deckThenDueDate", label: "Deck, lalu tanggal jatuh tempo" },
  { value: "ascendingIntervals", label: "Interval terpendek dulu" },
  { value: "descendingIntervals", label: "Interval terpanjang dulu" },
  { value: "ascendingEase", label: "Paling sulit dulu" },
  { value: "descendingEase", label: "Paling mudah dulu" },
  { value: "ascendingRetrievability", label: "Retrievability menaik (paling mungkin lupa dulu)" },
  { value: "descendingRetrievability", label: "Retrievability menurun (paling mungkin ingat dulu)" },
  { value: "random", label: "Acak" },
];
