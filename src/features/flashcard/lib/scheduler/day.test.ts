import { describe, expect, it } from "vitest";
import {
  flashcardDaysBetween,
  getFlashcardDayEnd,
  getFlashcardDayRange,
  getFlashcardDayStart,
  isIntradayDue,
  isSameFlashcardDay,
} from "./day";

const JAKARTA = { timeZone: "Asia/Jakarta", rolloverHour: 4 };

/** Waktu Jakarta (UTC+7, tanpa DST) sebagai instant UTC. */
function jakarta(iso: string) {
  return new Date(`${iso}+07:00`);
}

describe("batas hari flashcard", () => {
  it("memulai hari pada jam rollover, bukan tengah malam", () => {
    const { start, endExclusive } = getFlashcardDayRange(
      jakarta("2026-09-03T10:00:00"),
      JAKARTA,
    );

    expect(start.toISOString()).toBe(jakarta("2026-09-03T04:00:00").toISOString());
    expect(endExclusive.toISOString()).toBe(jakarta("2026-09-04T04:00:00").toISOString());
  });

  it("menghitung jam 01:00 sebagai masih hari sebelumnya", () => {
    // Inilah alasan rollover ada: belajar lewat tengah malam tidak boleh
    // dianggap hari baru dan mereset daily limit.
    const start = getFlashcardDayStart(jakarta("2026-09-04T01:00:00"), JAKARTA);
    expect(start.toISOString()).toBe(jakarta("2026-09-03T04:00:00").toISOString());
  });

  it("menganggap 23:00 dan 01:00 keesokan harinya sebagai hari yang sama", () => {
    expect(
      isSameFlashcardDay(
        jakarta("2026-09-03T23:00:00"),
        jakarta("2026-09-04T01:00:00"),
        JAKARTA,
      ),
    ).toBe(true);
  });

  it("memisahkan 03:59 dan 04:01 sebagai dua hari berbeda", () => {
    expect(
      isSameFlashcardDay(
        jakarta("2026-09-04T03:59:00"),
        jakarta("2026-09-04T04:01:00"),
        JAKARTA,
      ),
    ).toBe(false);
  });

  it("rollover 0 berarti batas hari kembali ke tengah malam", () => {
    const midnight = { timeZone: "Asia/Jakarta", rolloverHour: 0 };
    const start = getFlashcardDayStart(jakarta("2026-09-04T01:00:00"), midnight);
    expect(start.toISOString()).toBe(jakarta("2026-09-04T00:00:00").toISOString());
  });
});

describe("intraday vs interday", () => {
  const now = jakarta("2026-09-03T22:00:00");

  it("kartu due 10 menit lagi masih intraday", () => {
    expect(isIntradayDue(jakarta("2026-09-03T22:10:00"), now, JAKARTA)).toBe(true);
  });

  it("kartu due jam 02:00 dini hari masih intraday karena belum lewat rollover", () => {
    expect(isIntradayDue(jakarta("2026-09-04T02:00:00"), now, JAKARTA)).toBe(true);
  });

  it("kartu due setelah rollover sudah interday", () => {
    expect(isIntradayDue(jakarta("2026-09-04T05:00:00"), now, JAKARTA)).toBe(false);
  });

  it("batas hari itu sendiri sudah dihitung interday", () => {
    expect(isIntradayDue(getFlashcardDayEnd(now, JAKARTA), now, JAKARTA)).toBe(false);
  });
});

describe("selisih hari", () => {
  it("menghitung selisih dari awal hari, bukan selisih jam", () => {
    expect(
      flashcardDaysBetween(
        jakarta("2026-09-03T23:00:00"),
        jakarta("2026-09-04T05:00:00"),
        JAKARTA,
      ),
    ).toBe(1);
  });

  it("nol untuk dua waktu di hari flashcard yang sama", () => {
    expect(
      flashcardDaysBetween(
        jakarta("2026-09-03T05:00:00"),
        jakarta("2026-09-04T03:00:00"),
        JAKARTA,
      ),
    ).toBe(0);
  });

  it("tetap bulat saat melewati transisi DST", () => {
    // New York pindah ke DST pada 8 Maret 2026; hari itu hanya 23 jam.
    const newYork = { timeZone: "America/New_York", rolloverHour: 4 };
    expect(
      flashcardDaysBetween(
        new Date("2026-03-07T12:00:00-05:00"),
        new Date("2026-03-09T12:00:00-04:00"),
        newYork,
      ),
    ).toBe(2);
  });
});
