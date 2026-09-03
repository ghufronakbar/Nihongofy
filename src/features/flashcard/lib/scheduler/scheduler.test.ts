import { describe, expect, it } from "vitest";
import {
  FLASHCARD_DEFAULT_PRESET_CONFIG,
  FlashcardPresetConfigSchema,
  type FlashcardPresetConfig,
} from "../../schemas";
import { createNewCardState, previewSchedule, scheduleReview } from "./index";
import type { SchedulerCardState } from "./types";

const DAY = { timeZone: "Asia/Jakarta", rolloverHour: 4 };
const NOW = new Date("2026-09-03T10:00:00+07:00");

function config(overrides: Partial<FlashcardPresetConfig> = {}): FlashcardPresetConfig {
  return FlashcardPresetConfigSchema.parse({
    // Fuzz dimatikan lewat maximum interval? Tidak — fuzz selalu aktif di FSRS,
    // jadi assertion memakai rentang, bukan angka persis.
    ...overrides,
  });
}

function reviewCard(overrides: Partial<SchedulerCardState> = {}): SchedulerCardState {
  return {
    ...createNewCardState(NOW),
    type: "REVIEW",
    queue: "REVIEW",
    intervalDays: 10,
    reps: 5,
    stability: 10,
    difficulty: 5,
    desiredRetention: 0.9,
    easeFactor: 2.5,
    lastReviewedAt: new Date("2026-08-24T10:00:00+07:00"),
    ...overrides,
  };
}

const minutesFrom = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 60_000);
const daysFrom = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86_400_000;

// ---------------------------------------------------------------------------
// FSRS
// ---------------------------------------------------------------------------

describe("FSRS — kartu baru", () => {
  it("menaruh kartu baru ke learning step pertama saat Again", () => {
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "AGAIN",
      now: NOW,
      config: config(),
      day: DAY,
    });

    expect(result.card.type).toBe("LEARNING");
    expect(result.card.queue).toBe("LEARNING");
    expect(minutesFrom(NOW, result.card.due)).toBe(1); // learning step "1m"
    expect(result.revlog.kind).toBe("LEARN");
  });

  it("maju ke step berikutnya saat Good", () => {
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "GOOD",
      now: NOW,
      config: config(),
      day: DAY,
    });

    expect(result.card.type).toBe("LEARNING");
    expect(minutesFrom(NOW, result.card.due)).toBe(10); // step kedua "10m"
    expect(result.card.learningStep).toBe(1);
  });

  it("langsung lulus ke REVIEW saat Easy", () => {
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "EASY",
      now: NOW,
      config: config(),
      day: DAY,
    });

    expect(result.card.type).toBe("REVIEW");
    expect(result.card.queue).toBe("REVIEW");
    expect(result.card.intervalDays).toBeGreaterThanOrEqual(1);
  });

  it("mengisi memory state FSRS dan mencatat desired retention", () => {
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "GOOD",
      now: NOW,
      config: config({ desiredRetention: 0.85 }),
      day: DAY,
    });

    expect(result.card.stability).toBeGreaterThan(0);
    expect(result.card.difficulty).toBeGreaterThanOrEqual(1);
    expect(result.card.difficulty).toBeLessThanOrEqual(10);
    expect(result.card.desiredRetention).toBe(0.85);
    expect(result.card.easeFactor).toBeNull();
  });
});

describe("FSRS — kartu review", () => {
  it("Again membuat kartu lapse dan masuk relearning", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "AGAIN",
      now: NOW,
      config: config(),
      day: DAY,
    });

    expect(result.card.type).toBe("RELEARNING");
    expect(result.card.lapses).toBe(1);
    expect(minutesFrom(NOW, result.card.due)).toBe(10); // relearning step "10m"
    expect(result.revlog.kind).toBe("REVIEW");
    expect(result.revlog.lastIntervalDays).toBe(10);
  });

  it("interval naik searah Hard < Good < Easy", () => {
    const preview = previewSchedule({
      card: reviewCard(),
      now: NOW,
      config: config(),
      day: DAY,
    });

    expect(preview.HARD.card.intervalDays).toBeLessThan(preview.GOOD.card.intervalDays);
    expect(preview.GOOD.card.intervalDays).toBeLessThan(preview.EASY.card.intervalDays);
  });

  it("desired retention lebih tinggi menghasilkan interval lebih pendek", () => {
    const base = reviewCard();
    const strict = scheduleReview({
      card: base,
      rating: "GOOD",
      now: NOW,
      config: config({ desiredRetention: 0.97 }),
      day: DAY,
    });
    const relaxed = scheduleReview({
      card: base,
      rating: "GOOD",
      now: NOW,
      config: config({ desiredRetention: 0.8 }),
      day: DAY,
    });

    expect(strict.card.intervalDays).toBeLessThan(relaxed.card.intervalDays);
  });

  it("menghormati maximum interval", () => {
    const result = scheduleReview({
      card: reviewCard({ intervalDays: 3_000, stability: 5_000 }),
      rating: "EASY",
      now: NOW,
      config: config({ maximumIntervalDays: 100 }),
      day: DAY,
    });

    expect(result.card.intervalDays).toBeLessThanOrEqual(100);
  });

  it("due kartu review selalu konsisten dengan intervalnya", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "GOOD",
      now: NOW,
      config: config(),
      day: DAY,
    });

    expect(daysFrom(NOW, result.card.due)).toBeCloseTo(result.card.intervalDays, 5);
  });
});

describe("FSRS — queue intraday vs interday", () => {
  it("relearning step 10 menit tetap queue LEARNING", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "AGAIN",
      now: NOW,
      config: config(),
      day: DAY,
    });
    expect(result.card.queue).toBe("LEARNING");
  });

  it("relearning step 4 jam yang melewati rollover jadi DAY_LEARN", () => {
    // Review jam 01:00 -> step 4 jam jatuh jam 05:00, sudah lewat rollover 04:00.
    const lateNight = new Date("2026-09-04T01:00:00+07:00");
    const result = scheduleReview({
      card: reviewCard(),
      rating: "AGAIN",
      now: lateNight,
      config: config({ relearningSteps: ["4h"] }),
      day: DAY,
    });

    expect(result.card.type).toBe("RELEARNING");
    expect(result.card.queue).toBe("DAY_LEARN");
  });

  it("step 4 jam yang belum melewati rollover tetap LEARNING", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "AGAIN",
      now: NOW, // 10:00, +4 jam = 14:00, masih hari yang sama
      config: config({ relearningSteps: ["4h"] }),
      day: DAY,
    });

    expect(result.card.queue).toBe("LEARNING");
  });
});

describe("deteksi leech", () => {
  const leechConfig = config({ leechThreshold: 4 });

  it("menandai leech tepat saat lapses menyentuh ambang", () => {
    const result = scheduleReview({
      card: reviewCard({ lapses: 3 }),
      rating: "AGAIN",
      now: NOW,
      config: leechConfig,
      day: DAY,
    });

    expect(result.card.lapses).toBe(4);
    expect(result.becameLeech).toBe(true);
  });

  it("tidak menandai lagi pada lapse berikutnya", () => {
    const result = scheduleReview({
      card: reviewCard({ lapses: 4 }),
      rating: "AGAIN",
      now: NOW,
      config: leechConfig,
      day: DAY,
    });

    expect(result.becameLeech).toBe(false);
  });

  it("menandai lagi setelah setengah ambang terlewati", () => {
    const result = scheduleReview({
      card: reviewCard({ lapses: 5 }),
      rating: "AGAIN",
      now: NOW,
      config: leechConfig,
      day: DAY,
    });

    expect(result.card.lapses).toBe(6);
    expect(result.becameLeech).toBe(true);
  });

  it("rating selain Again tidak pernah memicu leech", () => {
    const result = scheduleReview({
      card: reviewCard({ lapses: 10 }),
      rating: "GOOD",
      now: NOW,
      config: leechConfig,
      day: DAY,
    });

    expect(result.becameLeech).toBe(false);
  });

  it("threshold 0 mematikan deteksi leech", () => {
    const result = scheduleReview({
      card: reviewCard({ lapses: 99 }),
      rating: "AGAIN",
      now: NOW,
      config: config({ leechThreshold: 0 }),
      day: DAY,
    });

    expect(result.becameLeech).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SM-2 (fallback saat FSRS dimatikan)
// ---------------------------------------------------------------------------

const sm2 = (overrides: Partial<FlashcardPresetConfig> = {}) =>
  config({ fsrsEnabled: false, ...overrides });

describe("SM-2 — learning", () => {
  it("Good berjalan melewati step lalu lulus dengan graduating interval", () => {
    const first = scheduleReview({
      card: createNewCardState(NOW),
      rating: "GOOD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });
    expect(first.card.type).toBe("LEARNING");
    expect(minutesFrom(NOW, first.card.due)).toBe(10);

    const second = scheduleReview({
      card: first.card,
      rating: "GOOD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });
    expect(second.card.type).toBe("REVIEW");
    expect(second.card.intervalDays).toBe(1); // graduatingIntervalDays
  });

  it("Hard memakai rata-rata step sekarang dan berikutnya", () => {
    // steps [1m, 10m], di step 0 -> (1 + 10) / 2 = 5.5 menit
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "HARD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect((result.card.due.getTime() - NOW.getTime()) / 60_000).toBeCloseTo(5.5, 5);
    expect(result.card.learningStep).toBe(0);
  });

  it("Hard di step terakhir memakai step sekarang dikali 1.5", () => {
    const result = scheduleReview({
      card: { ...createNewCardState(NOW), type: "LEARNING", learningStep: 1 },
      rating: "HARD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect(minutesFrom(NOW, result.card.due)).toBe(15); // 10m * 1.5
  });

  it("Easy lulus langsung dengan easy interval dan menaikkan ease", () => {
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "EASY",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect(result.card.type).toBe("REVIEW");
    expect(result.card.intervalDays).toBe(4); // easyIntervalDays
    expect(result.card.easeFactor).toBeCloseTo(2.65, 5);
  });

  it("steps kosong membuat kartu langsung lulus", () => {
    const result = scheduleReview({
      card: createNewCardState(NOW),
      rating: "GOOD",
      now: NOW,
      config: sm2({ learningSteps: [] }),
      day: DAY,
    });

    expect(result.card.type).toBe("REVIEW");
  });
});

describe("SM-2 — review", () => {
  it("Good mengalikan interval dengan ease", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "GOOD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect(result.card.intervalDays).toBe(25); // 10 * 2.5
    expect(result.card.easeFactor).toBe(2.5);
  });

  it("Hard memakai hard interval dan menurunkan ease", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "HARD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect(result.card.intervalDays).toBe(12); // 10 * 1.2
    expect(result.card.easeFactor).toBeCloseTo(2.35, 5);
  });

  it("Easy menerapkan easy bonus dan menaikkan ease", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "EASY",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect(result.card.intervalDays).toBe(33); // round(10 * 2.5 * 1.3)
    expect(result.card.easeFactor).toBeCloseTo(2.65, 5);
  });

  it("Again menurunkan ease 0.20 dan memakai new interval", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "AGAIN",
      now: NOW,
      config: sm2({ newInterval: 0.5, minimumIntervalDays: 1 }),
      day: DAY,
    });

    expect(result.card.type).toBe("RELEARNING");
    expect(result.card.lapses).toBe(1);
    expect(result.card.intervalDays).toBe(5); // 10 * 0.5
    expect(result.card.easeFactor).toBeCloseTo(2.3, 5);
  });

  it("Again menghormati minimum interval", () => {
    const result = scheduleReview({
      card: reviewCard({ intervalDays: 2 }),
      rating: "AGAIN",
      now: NOW,
      config: sm2({ newInterval: 0, minimumIntervalDays: 3 }),
      day: DAY,
    });

    expect(result.card.intervalDays).toBe(3);
  });

  it("ease tidak pernah turun di bawah 1.30", () => {
    let card = reviewCard({ easeFactor: 1.35 });
    for (let index = 0; index < 5; index += 1) {
      card = scheduleReview({
        card: { ...card, type: "REVIEW", queue: "REVIEW" },
        rating: "HARD",
        now: NOW,
        config: sm2(),
        day: DAY,
      }).card;
    }

    expect(card.easeFactor).toBe(1.3);
  });

  it("interval selalu bertambah minimal satu hari", () => {
    // hardInterval 1.0 pada interval 10 hari akan menghasilkan 10 tanpa jaminan ini.
    const result = scheduleReview({
      card: reviewCard(),
      rating: "HARD",
      now: NOW,
      config: sm2({ hardInterval: 1 }),
      day: DAY,
    });

    expect(result.card.intervalDays).toBe(11);
  });

  it("interval modifier menskala hasil", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "GOOD",
      now: NOW,
      config: sm2({ intervalModifier: 0.8 }),
      day: DAY,
    });

    expect(result.card.intervalDays).toBe(20); // round(10 * 2.5 * 0.8)
  });

  it("memberi bonus untuk review yang telat", () => {
    const late = new Date("2026-09-13T10:00:00+07:00"); // 10 hari lewat due
    const onTime = scheduleReview({
      card: reviewCard(),
      rating: "GOOD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });
    const overdue = scheduleReview({
      card: reviewCard({ due: NOW }),
      rating: "GOOD",
      now: late,
      config: sm2(),
      day: DAY,
    });

    expect(overdue.card.intervalDays).toBeGreaterThan(onTime.card.intervalDays);
  });

  it("tidak pernah mengisi memory state FSRS", () => {
    const result = scheduleReview({
      card: reviewCard(),
      rating: "GOOD",
      now: NOW,
      config: sm2(),
      day: DAY,
    });

    expect(result.card.stability).toBeNull();
    expect(result.card.difficulty).toBeNull();
    expect(result.card.easeFactor).not.toBeNull();
  });
});

describe("preset default", () => {
  it("memakai 21 parameter FSRS-6", () => {
    expect(FLASHCARD_DEFAULT_PRESET_CONFIG.fsrsParameters).toHaveLength(21);
    expect(FLASHCARD_DEFAULT_PRESET_CONFIG.fsrsEnabled).toBe(true);
    expect(FLASHCARD_DEFAULT_PRESET_CONFIG.desiredRetention).toBe(0.9);
  });

  it("menolak jumlah parameter FSRS yang salah", () => {
    expect(
      FlashcardPresetConfigSchema.safeParse({ fsrsParameters: [1, 2, 3] }).success,
    ).toBe(false);
  });

  it("menolak format learning step yang tidak valid", () => {
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["10x"] }).success).toBe(
      false,
    );
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["10m"] }).success).toBe(
      true,
    );
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["4h"] }).success).toBe(
      true,
    );
  });

  // Dua batasan ts-fsrs berikut gagal DIAM-DIAM kalau tidak dijaga di schema:
  // "30s" dibulatkan jadi 0 menit lalu seluruh array step diabaikan, dan step
  // >= 1 hari dikembalikan sebagai State.Review sehingga tak bisa dibedakan
  // dari kartu review biasa. Test ini yang menahan keduanya.
  it("menolak step dalam detik", () => {
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["30s"] }).success).toBe(
      false,
    );
  });

  it("menolak step 1 hari atau lebih", () => {
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["1d"] }).success).toBe(
      false,
    );
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["24h"] }).success).toBe(
      false,
    );
    expect(FlashcardPresetConfigSchema.safeParse({ learningSteps: ["23h"] }).success).toBe(
      true,
    );
  });
});
