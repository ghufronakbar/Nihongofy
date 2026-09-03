import { scheduleWithFsrs } from "./fsrs";
import { scheduleWithSm2 } from "./sm2";
import {
  FLASHCARD_RATINGS,
  type SchedulerCardState,
  type SchedulerInput,
  type SchedulerPreview,
  type SchedulerResult,
} from "./types";

export * from "./day";
export * from "./types";
export { getRetrievability } from "./fsrs";
export { parseStepToMs } from "./sm2";

/**
 * Satu-satunya pintu masuk penjadwalan. Pemilihan FSRS vs SM-2 ditentukan
 * preset deck, bukan pemanggil.
 */
export function scheduleReview(input: SchedulerInput): SchedulerResult {
  return input.config.fsrsEnabled ? scheduleWithFsrs(input) : scheduleWithSm2(input);
}

/**
 * Hasil untuk keempat tombol sekaligus, supaya reviewer bisa menampilkan
 * interval di tiap tombol sebelum user memilih.
 *
 * Catatan: dengan `enable_fuzz` aktif, interval yang ditampilkan di sini bisa
 * berbeda beberapa persen dari hasil `scheduleReview` yang sebenarnya dicatat —
 * sama seperti Anki, fuzz diundi ulang setiap perhitungan.
 */
export function previewSchedule(
  input: Omit<SchedulerInput, "rating">,
): SchedulerPreview {
  return Object.fromEntries(
    FLASHCARD_RATINGS.map((rating) => [rating, scheduleReview({ ...input, rating })]),
  ) as SchedulerPreview;
}

/** State awal kartu baru sebelum review pertama. */
export function createNewCardState(now: Date): SchedulerCardState {
  return {
    type: "NEW",
    queue: "NEW",
    due: now,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    learningStep: 0,
    stability: null,
    difficulty: null,
    desiredRetention: null,
    easeFactor: null,
    lastReviewedAt: null,
  };
}

