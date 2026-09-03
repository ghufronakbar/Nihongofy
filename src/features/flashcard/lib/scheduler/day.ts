import { getZonedDayRangeFromHour } from "@/lib/time-zone";

/**
 * Batas hari untuk flashcard.
 *
 * Berbeda dari modul lain di project ini yang memakai batas 00:00, Anki memulai
 * hari pada jam rollover (default 04:00 lokal) supaya sesi belajar yang lewat
 * tengah malam tetap dihitung sebagai hari yang sama. Daily limit, pembedaan
 * kartu learning intraday vs interday, dan unbury harian semuanya memakai batas
 * ini — bukan tengah malam.
 */

export type FlashcardDayContext = {
  timeZone: string;
  rolloverHour: number;
};

export const FLASHCARD_DEFAULT_ROLLOVER_HOUR = 4;

export function getFlashcardDayRange(now: Date, context: FlashcardDayContext) {
  return getZonedDayRangeFromHour(now, context.timeZone, context.rolloverHour);
}

/** Awal hari flashcard yang memuat `now`. */
export function getFlashcardDayStart(now: Date, context: FlashcardDayContext) {
  return getFlashcardDayRange(now, context).start;
}

/** Batas akhir hari flashcard (eksklusif) — juga awal hari berikutnya. */
export function getFlashcardDayEnd(now: Date, context: FlashcardDayContext) {
  return getFlashcardDayRange(now, context).endExclusive;
}

export function isSameFlashcardDay(
  left: Date,
  right: Date,
  context: FlashcardDayContext,
) {
  return (
    getFlashcardDayStart(left, context).getTime() ===
    getFlashcardDayStart(right, context).getTime()
  );
}

/**
 * Apakah kartu learning ini masih jatuh tempo di hari yang sama.
 *
 * Inilah yang memisahkan queue `LEARNING` (intraday) dari `DAY_LEARN`
 * (interday) di Anki: bukan panjang intervalnya, tapi apakah waktu due-nya
 * masih di dalam hari yang sedang berjalan.
 */
export function isIntradayDue(due: Date, now: Date, context: FlashcardDayContext) {
  return due.getTime() < getFlashcardDayEnd(now, context).getTime();
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Selisih hari flashcard antara dua waktu (`to` - `from`).
 *
 * Dihitung dari awal-hari masing-masing lalu dibulatkan, sehingga transisi DST
 * (hari 23 atau 25 jam) tidak menghasilkan selisih pecahan.
 */
export function flashcardDaysBetween(
  from: Date,
  to: Date,
  context: FlashcardDayContext,
) {
  const fromStart = getFlashcardDayStart(from, context).getTime();
  const toStart = getFlashcardDayStart(to, context).getTime();
  return Math.round((toStart - fromStart) / DAY_IN_MS);
}
