import { describe, expect, it } from "vitest";
import { FlashcardConfigSchema, type FlashcardConfig } from "../../schemas";
import { buildQueue } from "./gather";
import { insertionPosition } from "./sort";
import type { QueueBudget, QueueCandidate } from "./types";

const DAY = { timeZone: "Asia/Jakarta", rolloverHour: 4 };
const NOW = new Date("2026-09-03T10:00:00+07:00");
const MINUTE = 60_000;

const config = (overrides: Partial<FlashcardConfig> = {}) => FlashcardConfigSchema.parse(overrides);

/** Acak deterministik supaya urutan bisa di-assert. */
const seededRandom = (seed = 1) => {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
};

let nextId = 0;
function card(overrides: Partial<QueueCandidate> = {}): QueueCandidate {
  nextId += 1;
  return {
    vocabId: nextId,
    type: "NEW",
    queue: "NEW",
    due: NOW,
    position: nextId,
    intervalDays: 0,
    easeFactor: null,
    stability: null,
    difficulty: null,
    lastReviewedAt: null,
    reps: 0,
    lapses: 0,
    learningStep: 0,
    ...overrides,
  };
}

const reviewCard = (overrides: Partial<QueueCandidate> = {}) =>
  card({
    type: "REVIEW",
    queue: "REVIEW",
    due: new Date("2026-09-03T06:00:00+07:00"),
    intervalDays: 10,
    easeFactor: 2.5,
    stability: 10,
    difficulty: 5,
    reps: 5,
    lastReviewedAt: new Date("2026-08-24T10:00:00+07:00"),
    ...overrides,
  });

const learningCard = (dueInMinutes: number, overrides: Partial<QueueCandidate> = {}) =>
  card({
    type: "LEARNING",
    queue: "LEARNING",
    due: new Date(NOW.getTime() + dueInMinutes * MINUTE),
    stability: 1,
    difficulty: 5,
    reps: 1,
    lastReviewedAt: NOW,
    ...overrides,
  });

// Urutan tampil dibuat eksplisit supaya test tidak bergantung pada default
// pengaturan, yang memang boleh berubah.
const BASE: Partial<FlashcardConfig> = {
  newCardGatherOrder: "ascendingPosition",
  newCardSortOrder: "gather",
  newReviewOrder: "afterReviews",
  interdayLearningReviewOrder: "beforeReviews",
  reviewSortOrder: "dueDateThenRandom",
};

const build = (
  candidates: QueueCandidate[],
  overrides: Partial<FlashcardConfig> = {},
  budget: QueueBudget = { newLimit: 999, reviewLimit: 999 },
) =>
  buildQueue({
    candidates,
    budget,
    config: config({ ...BASE, ...overrides }),
    now: NOW,
    day: DAY,
    random: seededRandom(),
  });

const ids = (entries: { vocabId: number }[]) => entries.map((entry) => entry.vocabId);

// ---------------------------------------------------------------------------

describe("urutan pengambilan", () => {
  it("intraday learning yang jatuh tempo selalu paling depan", () => {
    const fresh = card();
    const review = reviewCard();
    const learning = learningCard(-5);

    const { queue } = build([fresh, review, learning]);
    expect(queue[0]!.vocabId).toBe(learning.vocabId);
  });

  it("interday learning didahulukan atas review bila diminta", () => {
    const review = reviewCard();
    const interday = card({
      type: "LEARNING",
      queue: "DAY_LEARN",
      due: new Date("2026-09-03T05:00:00+07:00"),
      stability: 1,
      difficulty: 5,
    });

    const { queue } = build([review, interday], { interdayLearningReviewOrder: "beforeReviews" });
    expect(ids(queue)).toEqual([interday.vocabId, review.vocabId]);

    const after = build([review, interday], { interdayLearningReviewOrder: "afterReviews" });
    expect(ids(after.queue)).toEqual([review.vocabId, interday.vocabId]);
  });

  it("mengambil review dan interday learning yang jatuh tempo nanti hari ini", () => {
    // Keduanya jatuh tempo per hari, bukan per menit, seperti Anki.
    const laterToday = reviewCard({ due: new Date("2026-09-03T22:00:00+07:00") });
    const { queue } = build([laterToday]);
    expect(ids(queue)).toEqual([laterToday.vocabId]);
  });

  it("tidak mengambil kartu yang jatuh tempo setelah batas hari (04:00 besok)", () => {
    const tomorrow = reviewCard({ due: new Date("2026-09-04T05:00:00+07:00") });
    const learning = learningCard(60 * 20);
    const { queue, laterLearning } = build([tomorrow, learning]);
    expect(queue).toHaveLength(0);
    expect(laterLearning).toHaveLength(0);
  });
});

describe("learn ahead", () => {
  it("kartu learning dalam 20 menit ke depan ikut tampil", () => {
    const soon = learningCard(10);
    const { queue, laterLearning } = build([soon]);
    expect(ids(queue)).toEqual([soon.vocabId]);
    expect(laterLearning).toHaveLength(0);
  });

  it("kartu learning dengan step 2 jam ditahan, tidak tampil seketika", () => {
    const later = learningCard(120);
    const earlier = learningCard(45);
    const { queue, laterLearning } = build([later, earlier]);
    expect(queue).toHaveLength(0);
    expect(ids(laterLearning)).toEqual([earlier.vocabId, later.vocabId]);
  });
});

describe("batas harian", () => {
  it("membatasi kartu baru", () => {
    const cards = [card(), card(), card()];
    const { queue } = build(cards, {}, { newLimit: 2, reviewLimit: 999 });
    expect(queue).toHaveLength(2);
  });

  it("membatasi review, dengan interday learning memakan jatahnya lebih dulu", () => {
    const interday = card({
      type: "RELEARNING",
      queue: "DAY_LEARN",
      due: new Date("2026-09-03T05:00:00+07:00"),
      stability: 1,
      difficulty: 5,
    });
    const reviews = [reviewCard(), reviewCard()];
    const { counts } = build([...reviews, interday], {}, { newLimit: 0, reviewLimit: 2 });
    expect(counts.interdayLearning).toBe(1);
    expect(counts.review).toBe(1);
  });

  it("tidak membatasi intraday learning", () => {
    const learning = [learningCard(-1), learningCard(-2), learningCard(-3)];
    const { queue } = build(learning, {}, { newLimit: 0, reviewLimit: 0 });
    expect(queue).toHaveLength(3);
  });

  it("kartu baru ikut memakan sisa review limit secara default", () => {
    const reviews = [reviewCard(), reviewCard()];
    const fresh = [card(), card()];
    const { counts } = build([...reviews, ...fresh], {}, { newLimit: 10, reviewLimit: 3 });
    expect(counts.review).toBe(2);
    expect(counts.new).toBe(1);
  });

  it("newCardsIgnoreReviewLimit melepaskan kartu baru dari review limit", () => {
    const reviews = [reviewCard(), reviewCard()];
    const fresh = [card(), card()];
    const { counts } = build(
      [...reviews, ...fresh],
      { newCardsIgnoreReviewLimit: true },
      { newLimit: 10, reviewLimit: 2 },
    );
    expect(counts.new).toBe(2);
  });
});

describe("urutan tampil", () => {
  it("newReviewOrder menaruh kartu baru di depan atau belakang review", () => {
    const review = reviewCard();
    const fresh = card();

    expect(ids(build([review, fresh], { newReviewOrder: "beforeReviews" }).queue)).toEqual([
      fresh.vocabId,
      review.vocabId,
    ]);
    expect(ids(build([review, fresh], { newReviewOrder: "afterReviews" }).queue)).toEqual([
      review.vocabId,
      fresh.vocabId,
    ]);
  });

  it("mix menyebar kartu baru di antara review", () => {
    const reviews = [reviewCard(), reviewCard(), reviewCard(), reviewCard()];
    const fresh = [card(), card()];
    const { queue } = build([...reviews, ...fresh], { newReviewOrder: "mix" });
    const newIndexes = queue.flatMap((entry, index) => (entry.group === "new" ? [index] : []));
    expect(newIndexes).not.toEqual([4, 5]);
    expect(newIndexes).not.toEqual([0, 1]);
  });

  it("posisi menaik dan menurun", () => {
    const first = card({ position: 1 });
    const second = card({ position: 2 });
    const third = card({ position: 3 });
    const all = [third, first, second];

    expect(ids(build(all, { newCardGatherOrder: "ascendingPosition" }).queue)).toEqual([
      first.vocabId,
      second.vocabId,
      third.vocabId,
    ]);
    expect(ids(build(all, { newCardGatherOrder: "descendingPosition" }).queue)).toEqual([
      third.vocabId,
      second.vocabId,
      first.vocabId,
    ]);
  });

  it("kartu acak mengambil dari seluruh kartu baru, bukan hanya posisi teratas", () => {
    const fresh = Array.from({ length: 40 }, (_, index) => card({ position: index + 1 }));
    const { queue } = build(fresh, { newCardGatherOrder: "randomCards" }, { newLimit: 10, reviewLimit: 999 });
    expect(queue).toHaveLength(10);
    expect(Math.max(...queue.map((entry) => entry.position))).toBeGreaterThan(10);
  });

  it("interval terpendek dulu", () => {
    const long = reviewCard({ intervalDays: 30 });
    const short = reviewCard({ intervalDays: 3 });
    const { queue } = build([long, short], { reviewSortOrder: "ascendingIntervals" });
    expect(ids(queue)).toEqual([short.vocabId, long.vocabId]);
  });

  it("retrievability menurun menampilkan kartu yang paling mungkin diingat lebih dulu", () => {
    // Stabilitas sama, yang baru direview kemarin lebih mungkin diingat
    // daripada yang direview sebulan lalu.
    const fresh = reviewCard({ stability: 20, lastReviewedAt: new Date("2026-09-02T10:00:00+07:00") });
    const stale = reviewCard({ stability: 20, lastReviewedAt: new Date("2026-08-03T10:00:00+07:00") });

    const descending = build([stale, fresh], { reviewSortOrder: "descendingRetrievability" });
    expect(ids(descending.queue)).toEqual([fresh.vocabId, stale.vocabId]);

    const ascending = build([fresh, stale], { reviewSortOrder: "ascendingRetrievability" });
    expect(ids(ascending.queue)).toEqual([stale.vocabId, fresh.vocabId]);
  });

  it("due date berarti hari jatuh tempo: hari yang lebih awal selalu lebih dulu", () => {
    const older = reviewCard({ due: new Date("2026-09-01T09:00:00+07:00") });
    const today = reviewCard({ due: new Date("2026-09-03T06:00:00+07:00") });
    const { queue } = build([today, older], { reviewSortOrder: "dueDateThenRandom" });
    expect(ids(queue)).toEqual([older.vocabId, today.vocabId]);
  });
});

describe("insertion order", () => {
  it("berurutan: level termudah dulu, lalu urutan daftar sumber", () => {
    const n5Late = insertionPosition("sequential", 1, { id: 1, level: "N5", order: 900 });
    const n4Early = insertionPosition("sequential", 1, { id: 2, level: "N4", order: 1 });
    expect(n5Late).toBeLessThan(n4Early);
  });

  it("acak: stabil untuk user yang sama, berbeda antar user", () => {
    const vocab = { id: 42, level: "N5", order: 1 };
    expect(insertionPosition("random", 7, vocab)).toBe(insertionPosition("random", 7, vocab));

    const positions = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, level: "N5", order: index + 1 }));
    const forUser = (userId: number) =>
      [...positions]
        .sort((left, right) => insertionPosition("random", userId, left) - insertionPosition("random", userId, right))
        .map((item) => item.id);
    expect(forUser(1)).not.toEqual(forUser(2));
    expect(forUser(1)).not.toEqual(positions.map((item) => item.id));
  });
});
