import { describe, expect, it } from "vitest";
import {
  FlashcardPresetConfigSchema,
  type FlashcardPresetConfig,
} from "../../schemas";
import { buildQueue } from "./gather";
import { budgetFromAncestors, computeDeckBudgets, type DeckLimitNode } from "./limits";
import type { DeckBudget, QueueCandidate } from "./types";

const DAY = { timeZone: "Asia/Jakarta", rolloverHour: 4 };
const NOW = new Date("2026-09-03T10:00:00+07:00");

const config = (overrides: Partial<FlashcardPresetConfig> = {}) =>
  FlashcardPresetConfigSchema.parse(overrides);

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
    cardId: String(nextId),
    noteId: `n${nextId}`,
    deckId: 1,
    ord: 0,
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

/** Plan datar: tiap deck berdiri sendiri, tanpa induk. */
const budgets = (entries: [number, Partial<DeckBudget>][] = [[1, {}]]) => ({
  budgets: new Map<number, DeckBudget>(
    entries.map(([deckId, budget]) => [
      deckId,
      { newLimit: 999, reviewLimit: 999, ...budget },
    ]),
  ),
  chains: new Map<number, number[]>(entries.map(([deckId]) => [deckId, [deckId]])),
});

const build = (candidates: QueueCandidate[], overrides: Partial<FlashcardPresetConfig> = {}, deckBudgets = budgets()) =>
  buildQueue({
    candidates,
    plan: deckBudgets,
    config: config(overrides),
    now: NOW,
    day: DAY,
    deckOrder: new Map([
      [1, 0],
      [2, 1],
      [3, 2],
    ]),
    random: seededRandom(),
  });

// ---------------------------------------------------------------------------

describe("urutan pengambilan", () => {
  it("intraday learning selalu paling depan", () => {
    const result = build([
      card(),
      reviewCard(),
      card({ queue: "LEARNING", type: "LEARNING", due: new Date("2026-09-03T10:05:00+07:00") }),
    ]);

    expect(result.queue[0]!.group).toBe("intradayLearning");
  });

  it("interday learning didahulukan atas review", () => {
    const result = build(
      [
        reviewCard(),
        card({
          queue: "DAY_LEARN",
          type: "RELEARNING",
          due: new Date("2026-09-03T08:00:00+07:00"),
        }),
      ],
      { newReviewOrder: "afterReviews", interdayLearningReviewOrder: "beforeReviews" },
    );

    expect(result.queue.map((entry) => entry.group)).toEqual([
      "interdayLearning",
      "review",
    ]);
  });

  it("mengabaikan kartu suspended dan buried", () => {
    const result = build([
      reviewCard({ queue: "SUSPENDED" }),
      reviewCard({ queue: "BURIED_USER" }),
      reviewCard({ queue: "BURIED_SIBLING" }),
      reviewCard(),
    ]);

    expect(result.queue).toHaveLength(1);
  });

  it("mengabaikan deck yang tidak punya budget", () => {
    const result = build([reviewCard({ deckId: 9 })]);
    expect(result.queue).toHaveLength(0);
  });

  it("mengambil kartu yang due nanti hari ini, bukan hanya yang sudah lewat", () => {
    // Inilah yang membuat kartu ber-rating Again kembali dalam sesi yang sama
    // tanpa perlu reload halaman.
    const result = build([
      card({
        queue: "LEARNING",
        type: "LEARNING",
        due: new Date("2026-09-03T10:10:00+07:00"),
      }),
    ]);

    expect(result.queue).toHaveLength(1);
  });

  it("tidak mengambil kartu yang due setelah batas hari", () => {
    const result = build([
      reviewCard({ due: new Date("2026-09-04T05:00:00+07:00") }),
    ]);

    expect(result.queue).toHaveLength(0);
  });
});

describe("daily limit", () => {
  it("membatasi kartu baru", () => {
    const result = build(
      [card(), card(), card(), card(), card()],
      {},
      budgets([[1, { newLimit: 2 }]]),
    );

    expect(result.counts.new).toBe(2);
  });

  it("membatasi review", () => {
    const result = build(
      [reviewCard(), reviewCard(), reviewCard()],
      {},
      budgets([[1, { reviewLimit: 1 }]]),
    );

    expect(result.counts.review).toBe(1);
  });

  it("tidak membatasi intraday learning", () => {
    const learning = Array.from({ length: 5 }, () =>
      card({ queue: "LEARNING", type: "LEARNING", due: NOW }),
    );
    const result = build(learning, {}, budgets([[1, { reviewLimit: 0, newLimit: 0 }]]));

    expect(result.counts.intradayLearning).toBe(5);
  });

  it("interday learning memakan review limit lebih dulu", () => {
    const result = build(
      [
        card({ queue: "DAY_LEARN", type: "RELEARNING", due: new Date("2026-09-03T08:00:00+07:00") }),
        reviewCard(),
        reviewCard(),
      ],
      {},
      budgets([[1, { reviewLimit: 2 }]]),
    );

    expect(result.counts.interdayLearning).toBe(1);
    expect(result.counts.review).toBe(1);
  });

  it("kartu baru ikut memakan review limit secara default", () => {
    // Anki: 200 review limit, 190 review due -> hanya 10 kartu baru yang masuk.
    const reviews = Array.from({ length: 3 }, () => reviewCard());
    const news = Array.from({ length: 5 }, () => card());
    const result = build(
      [...reviews, ...news],
      {},
      budgets([[1, { reviewLimit: 4, newLimit: 5 }]]),
    );

    expect(result.counts.review).toBe(3);
    expect(result.counts.new).toBe(1);
  });

  it("newCardsIgnoreReviewLimit melepaskan kartu baru dari review limit", () => {
    const reviews = Array.from({ length: 3 }, () => reviewCard());
    const news = Array.from({ length: 5 }, () => card());
    const result = build(
      [...reviews, ...news],
      { newCardsIgnoreReviewLimit: true },
      budgets([[1, { reviewLimit: 3, newLimit: 5 }]]),
    );

    expect(result.counts.review).toBe(3);
    expect(result.counts.new).toBe(5);
  });

  it("limit induk membatasi TOTAL subtree, bukan tiap subdeck", () => {
    // Bug yang sempat lolos: induk berlimit 20 dengan dua anak menghasilkan 40
    // kartu, karena satu kartu hanya memakan jatah deck-nya sendiri. Di Anki
    // satu kartu memakan jatah deck itu DAN seluruh leluhurnya.
    const tree: DeckLimitNode = {
      deckId: 1,
      config: config({ newCardsPerDay: 5 }),
      studiedNewToday: 0,
      studiedReviewsToday: 0,
      children: [
        {
          deckId: 2,
          config: config({ newCardsPerDay: 5 }),
          studiedNewToday: 0,
          studiedReviewsToday: 0,
          children: [],
        },
        {
          deckId: 3,
          config: config({ newCardsPerDay: 5 }),
          studiedNewToday: 0,
          studiedReviewsToday: 0,
          children: [],
        },
      ],
    };

    const cards = [
      ...Array.from({ length: 5 }, () => card({ deckId: 2 })),
      ...Array.from({ length: 5 }, () => card({ deckId: 3 })),
    ];

    const result = build(cards, {}, computeDeckBudgets(tree));
    expect(result.counts.new).toBe(5);
  });

  it("subdeck tetap dibatasi limitnya sendiri di bawah induk yang longgar", () => {
    const tree: DeckLimitNode = {
      deckId: 1,
      config: config({ newCardsPerDay: 100 }),
      studiedNewToday: 0,
      studiedReviewsToday: 0,
      children: [
        {
          deckId: 2,
          config: config({ newCardsPerDay: 2 }),
          studiedNewToday: 0,
          studiedReviewsToday: 0,
          children: [],
        },
        {
          deckId: 3,
          config: config({ newCardsPerDay: 3 }),
          studiedNewToday: 0,
          studiedReviewsToday: 0,
          children: [],
        },
      ],
    };

    const cards = [
      ...Array.from({ length: 9 }, () => card({ deckId: 2 })),
      ...Array.from({ length: 9 }, () => card({ deckId: 3 })),
    ];

    const result = build(cards, {}, computeDeckBudgets(tree));
    const perDeck = result.queue.reduce<Record<number, number>>((total, entry) => {
      total[entry.deckId] = (total[entry.deckId] ?? 0) + 1;
      return total;
    }, {});

    expect(perDeck[2]).toBe(2);
    expect(perDeck[3]).toBe(3);
    expect(result.counts.new).toBe(5);
  });

  it("limit dihitung per deck, bukan global", () => {
    // Bug modul lama: limit berlaku global lintas deck karena review log tidak
    // menyimpan deck.
    const result = build(
      [card({ deckId: 1 }), card({ deckId: 1 }), card({ deckId: 2 }), card({ deckId: 2 })],
      {},
      budgets([
        [1, { newLimit: 1 }],
        [2, { newLimit: 2 }],
      ]),
    );

    const perDeck = result.queue.reduce<Record<number, number>>((total, entry) => {
      total[entry.deckId] = (total[entry.deckId] ?? 0) + 1;
      return total;
    }, {});

    expect(perDeck[1]).toBe(1);
    expect(perDeck[2]).toBe(2);
  });
});

describe("budget deck hierarkis", () => {
  const node = (
    deckId: number,
    limits: Partial<FlashcardPresetConfig>,
    studied: { newCards?: number; reviews?: number } = {},
    children: DeckLimitNode[] = [],
  ): DeckLimitNode => ({
    deckId,
    config: config(limits),
    studiedNewToday: studied.newCards ?? 0,
    studiedReviewsToday: studied.reviews ?? 0,
    children,
  });

  it("budget anak dipotong oleh budget induk", () => {
    const tree = node(1, { newCardsPerDay: 10 }, {}, [
      node(2, { newCardsPerDay: 50 }),
    ]);
    const result = computeDeckBudgets(tree).budgets;

    expect(result.get(1)!.newLimit).toBe(10);
    expect(result.get(2)!.newLimit).toBe(10);
  });

  it("anak dengan limit lebih kecil tetap dipakai", () => {
    const tree = node(1, { newCardsPerDay: 50 }, {}, [node(2, { newCardsPerDay: 5 })]);
    const result = computeDeckBudgets(tree).budgets;

    expect(result.get(1)!.newLimit).toBe(50);
    expect(result.get(2)!.newLimit).toBe(5);
  });

  it("mengurangi yang sudah dipelajari hari ini di seluruh subtree", () => {
    const tree = node(1, { newCardsPerDay: 20 }, { newCards: 3 }, [
      node(2, { newCardsPerDay: 20 }, { newCards: 5 }),
    ]);
    const result = computeDeckBudgets(tree).budgets;

    expect(result.get(1)!.newLimit).toBe(12); // 20 - (3 + 5)
    expect(result.get(2)!.newLimit).toBe(12); // 20 - 5 = 15, tapi dipotong induk jadi 12
  });

  it("tidak pernah negatif", () => {
    const tree = node(1, { newCardsPerDay: 5 }, { newCards: 99 });
    expect(computeDeckBudgets(tree).budgets.get(1)!.newLimit).toBe(0);
  });

  it("limit induk diabaikan kecuali limitsStartFromTop", () => {
    const selected = node(2, { newCardsPerDay: 30 });

    const withoutTop = computeDeckBudgets(selected).budgets;
    expect(withoutTop.get(2)!.newLimit).toBe(30);

    const withTop = computeDeckBudgets(
      selected,
      budgetFromAncestors([
        { config: config({ newCardsPerDay: 8 }), studiedNewToday: 0, studiedReviewsToday: 0 },
      ]),
    ).budgets;
    expect(withTop.get(2)!.newLimit).toBe(8);
  });
});

describe("sibling burying", () => {
  it("mem-bury kartu baru bersaudara saat diaktifkan", () => {
    const result = build(
      [card({ noteId: "n1", ord: 0 }), card({ noteId: "n1", ord: 1 })],
      { buryNewSiblings: true },
    );

    expect(result.queue).toHaveLength(1);
    expect(result.buried).toHaveLength(1);
  });

  it("membiarkan keduanya saat burying dimatikan", () => {
    const result = build([card({ noteId: "n1", ord: 0 }), card({ noteId: "n1", ord: 1 })], {
      buryNewSiblings: false,
    });

    expect(result.queue).toHaveLength(2);
    expect(result.buried).toHaveLength(0);
  });

  it("kartu baru tidak bisa mem-bury kartu review yang lebih dulu diambil", () => {
    // Review diambil lebih dulu, jadi review yang bertahan dan kartu baru yang di-bury.
    const result = build(
      [
        card({ noteId: "shared", ord: 1 }),
        reviewCard({ noteId: "shared", ord: 0 }),
      ],
      { buryNewSiblings: true, buryReviewSiblings: true },
    );

    expect(result.queue).toHaveLength(1);
    expect(result.queue[0]!.group).toBe("review");
    expect(result.buried[0]!.group).toBe("new");
  });

  it("kartu intraday learning tidak pernah di-bury", () => {
    const result = build(
      [
        card({
          noteId: "shared",
          ord: 0,
          queue: "LEARNING",
          type: "LEARNING",
          due: NOW,
        }),
        card({
          noteId: "shared",
          ord: 1,
          queue: "LEARNING",
          type: "LEARNING",
          due: NOW,
        }),
      ],
      { buryNewSiblings: true, buryReviewSiblings: true },
    );

    expect(result.queue).toHaveLength(2);
  });
});

describe("display order", () => {
  it("newReviewOrder beforeReviews menaruh kartu baru di depan", () => {
    const result = build([reviewCard(), card()], { newReviewOrder: "beforeReviews" });
    expect(result.queue.map((entry) => entry.group)).toEqual(["new", "review"]);
  });

  it("newReviewOrder afterReviews menaruh kartu baru di belakang", () => {
    const result = build([card(), reviewCard()], { newReviewOrder: "afterReviews" });
    expect(result.queue.map((entry) => entry.group)).toEqual(["review", "new"]);
  });

  it("mix menyebar kartu baru di antara review", () => {
    const result = build(
      [reviewCard(), reviewCard(), reviewCard(), reviewCard(), card(), card()],
      { newReviewOrder: "mix" },
    );

    const groups = result.queue.map((entry) => entry.group);
    expect(groups.filter((group) => group === "new")).toHaveLength(2);
    // Kartu baru tidak menggerombol di satu ujung.
    expect(groups.indexOf("new")).toBeLessThan(groups.lastIndexOf("new") - 1);
  });

  it("templateThenGather menampilkan semua template 0 sebelum template 1", () => {
    const result = build(
      [
        card({ noteId: "a", ord: 1 }),
        card({ noteId: "a", ord: 0 }),
        card({ noteId: "b", ord: 1 }),
        card({ noteId: "b", ord: 0 }),
      ],
      { newCardSortOrder: "templateThenGather" },
    );

    expect(result.queue.map((entry) => entry.ord)).toEqual([0, 0, 1, 1]);
  });

  it("ascendingPosition mengurutkan kartu baru berdasarkan posisi", () => {
    const result = build(
      [card({ position: 30 }), card({ position: 10 }), card({ position: 20 })],
      { newCardGatherOrder: "ascendingPosition", newCardSortOrder: "gather" },
    );

    expect(result.queue.map((entry) => entry.position)).toEqual([10, 20, 30]);
  });

  it("descendingPosition membalik urutannya", () => {
    const result = build(
      [card({ position: 30 }), card({ position: 10 }), card({ position: 20 })],
      { newCardGatherOrder: "descendingPosition", newCardSortOrder: "gather" },
    );

    expect(result.queue.map((entry) => entry.position)).toEqual([30, 20, 10]);
  });

  it("gather order deck mengikuti urutan subdeck", () => {
    const result = build(
      [card({ deckId: 3 }), card({ deckId: 1 }), card({ deckId: 2 })],
      { newCardGatherOrder: "deck", newCardSortOrder: "gather" },
      budgets([
        [1, {}],
        [2, {}],
        [3, {}],
      ]),
    );

    expect(result.queue.map((entry) => entry.deckId)).toEqual([1, 2, 3]);
  });

  it("dueDateThenRandom mengurutkan review dari yang paling lama menunggu", () => {
    const result = build(
      [
        reviewCard({ due: new Date("2026-09-03T09:00:00+07:00") }),
        reviewCard({ due: new Date("2026-09-01T09:00:00+07:00") }),
        reviewCard({ due: new Date("2026-09-02T09:00:00+07:00") }),
      ],
      { reviewSortOrder: "dueDateThenRandom" },
    );

    const dues = result.queue.map((entry) => entry.due.toISOString());
    expect(dues).toEqual([...dues].sort());
  });

  it("ascendingIntervals menampilkan interval terpendek lebih dulu", () => {
    const result = build(
      [
        reviewCard({ intervalDays: 30 }),
        reviewCard({ intervalDays: 5 }),
        reviewCard({ intervalDays: 12 }),
      ],
      { reviewSortOrder: "ascendingIntervals" },
    );

    expect(result.queue.map((entry) => entry.intervalDays)).toEqual([5, 12, 30]);
  });

  it("relativeOverdueness mengurutkan naik berdasarkan retrievability", () => {
    // Stability rendah + lama tidak direview = paling mungkin sudah lupa.
    const fragile = reviewCard({
      stability: 2,
      lastReviewedAt: new Date("2026-08-01T10:00:00+07:00"),
    });
    const solid = reviewCard({
      stability: 200,
      lastReviewedAt: new Date("2026-09-02T10:00:00+07:00"),
    });

    const result = build([solid, fragile], { reviewSortOrder: "relativeOverdueness" });
    expect(result.queue[0]!.cardId).toBe(fragile.cardId);
  });
});
