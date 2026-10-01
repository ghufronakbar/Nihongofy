import { describe, expect, it } from "vitest";
import {
  countByKind,
  countDueInWindow,
  formatDuration,
  summarizeSession,
  type SessionAnswer,
} from "./session-summary";

const START = Date.parse("2026-10-01T09:00:00+07:00");

const answer = (overrides: Partial<SessionAnswer> = {}): SessionAnswer => ({
  vocabId: 1,
  wordPlain: "食事",
  kind: "review",
  rating: "GOOD",
  takenMs: 4_000,
  answeredAt: START,
  dueAt: null,
  becameLeech: false,
  ...overrides,
});

describe("countByKind", () => {
  it("menghitung per jenis dan menambahkan hitungan dasar", () => {
    const counts = countByKind(
      [{ kind: "new" }, { kind: "new" }, { kind: "learning" }, { kind: "review" }],
      { new: 10, learning: 0, review: 5 },
    );
    expect(counts).toEqual({ new: 12, learning: 1, review: 6 });
  });
});

describe("summarizeSession", () => {
  it("kosong saat belum ada jawaban", () => {
    const summary = summarizeSession([]);
    expect(summary.total).toBe(0);
    expect(summary.correctRate).toBeNull();
    expect(summary.averageSeconds).toBeNull();
    expect(summary.durationMs).toBe(0);
  });

  it("menghitung rating, persentase benar, dan kartu baru", () => {
    const summary = summarizeSession([
      answer({ vocabId: 1, kind: "new", rating: "AGAIN" }),
      answer({ vocabId: 2, kind: "review", rating: "GOOD" }),
      answer({ vocabId: 1, kind: "learning", rating: "HARD" }),
      answer({ vocabId: 3, kind: "new", rating: "EASY" }),
    ]);

    expect(summary.total).toBe(4);
    expect(summary.uniqueCards).toBe(3);
    expect(summary.newLearned).toBe(2);
    expect(summary.ratings).toEqual({ AGAIN: 1, HARD: 1, GOOD: 1, EASY: 1 });
    expect(summary.correctRate).toBeCloseTo(0.75, 5);
  });

  it("durasi dihitung dari kartu pertama tampil, rata-rata hanya dari jawaban berwaktu", () => {
    const summary = summarizeSession([
      answer({ takenMs: 5_000, answeredAt: START + 5_000 }),
      answer({ takenMs: 0, answeredAt: START + 60_000 }),
      answer({ takenMs: 3_000, answeredAt: START + 120_000 }),
    ]);

    expect(summary.durationMs).toBe(120_000);
    expect(summary.answerMs).toBe(8_000);
    expect(summary.averageSeconds).toBeCloseTo(4, 5);
  });

  it("mengurutkan kartu yang paling sering terlupa dan membatasi lima", () => {
    const answers = [
      answer({ vocabId: 1, wordPlain: "一", rating: "AGAIN" }),
      ...[2, 3, 4, 5, 6, 7].map((vocabId) =>
        answer({ vocabId, wordPlain: String(vocabId), rating: "AGAIN" }),
      ),
      answer({ vocabId: 7, wordPlain: "7", rating: "AGAIN" }),
      answer({ vocabId: 8, rating: "GOOD" }),
    ];

    const { mostMissed } = summarizeSession(answers);
    expect(mostMissed).toHaveLength(5);
    expect(mostMissed[0]).toEqual({ vocabId: 7, wordPlain: "7", again: 2 });
    expect(mostMissed.some((card) => card.vocabId === 8)).toBe(false);
  });

  it("mencatat leech sekali per kartu", () => {
    const { leeches } = summarizeSession([
      answer({ vocabId: 4, wordPlain: "難", becameLeech: true }),
      answer({ vocabId: 4, wordPlain: "難", becameLeech: true }),
    ]);
    expect(leeches).toEqual([{ vocabId: 4, wordPlain: "難" }]);
  });
});

describe("countDueInWindow", () => {
  const from = Date.parse("2026-10-02T04:00:00+07:00");
  const to = Date.parse("2026-10-03T04:00:00+07:00");

  it("hanya jadwal terakhir tiap kartu yang dihitung", () => {
    const count = countDueInWindow(
      [
        // Kartu 1 sempat dijadwalkan besok, lalu dijawab lagi dan pindah lusa.
        answer({ vocabId: 1, dueAt: from + 1_000 }),
        answer({ vocabId: 1, dueAt: to + 1_000 }),
        answer({ vocabId: 2, dueAt: from }),
        answer({ vocabId: 3, dueAt: to }),
        answer({ vocabId: 4, dueAt: from - 1 }),
        answer({ vocabId: 5, dueAt: null }),
      ],
      from,
      to,
    );
    expect(count).toBe(1);
  });
});

describe("formatDuration", () => {
  it("memilih satuan yang ringkas", () => {
    expect(formatDuration(45_000)).toBe("45d");
    expect(formatDuration(245_000)).toBe("4m 05d");
    expect(formatDuration(3_900_000)).toBe("1j 05m");
  });
});
