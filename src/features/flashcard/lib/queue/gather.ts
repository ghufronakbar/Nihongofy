import type { FlashcardPresetConfig } from "../../schemas";
import { getFlashcardDayEnd, type FlashcardDayContext } from "../scheduler/day";
import { applySiblingBurying } from "./bury";
import { gatherNewCards, sortNewCards, sortReviewCards, type RandomFn } from "./sort";
import type { DeckBudgetPlan } from "./limits";
import type { DeckBudget, QueueCandidate, QueueCounts, QueueEntry } from "./types";

/**
 * Membangun antrean belajar sesuai scheduler v3 Anki.
 *
 * Urutan pengambilan tetap: intraday learning -> interday learning -> review -> new.
 * Urutan itu bukan sekadar preferensi tampilan — ia menentukan siapa yang boleh
 * mem-bury siapa, dan bagian mana dari review limit yang terpakai lebih dulu.
 */

export type BuildQueueInput = {
  candidates: QueueCandidate[];
  /** Budget dan rantai deck dari `computeDeckBudgets`. */
  plan: DeckBudgetPlan;
  config: FlashcardPresetConfig;
  now: Date;
  day: FlashcardDayContext;
  /** Urutan tampil subdeck, dipakai gather/sort order yang berbasis deck. */
  deckOrder: Map<number, number>;
  random?: RandomFn;
};

export type BuildQueueResult = {
  queue: QueueEntry[];
  buried: QueueEntry[];
  counts: QueueCounts;
};

function isStudiable(card: QueueCandidate) {
  return (
    card.queue !== "SUSPENDED" &&
    card.queue !== "BURIED_USER" &&
    card.queue !== "BURIED_SIBLING"
  );
}

/**
 * Jatah yang bisa "dipakai habis" saat memilih kartu.
 *
 * Satu kartu memakan jatah deck-nya SEKALIGUS seluruh leluhurnya, karena limit
 * sebuah deck di Anki membatasi total kartu dari subtree-nya — bukan tiap
 * subdeck secara terpisah.
 */
function makeAllocator(plan: DeckBudgetPlan, key: keyof DeckBudget) {
  const remaining = new Map<number, number>();
  for (const [deckId, budget] of plan.budgets) remaining.set(deckId, budget[key]);

  const chainOf = (deckId: number) => plan.chains.get(deckId) ?? [deckId];

  return {
    take(cards: QueueEntry[]): { taken: QueueEntry[]; count: number } {
      const taken: QueueEntry[] = [];
      for (const card of cards) {
        const chain = chainOf(card.deckId);
        if (chain.some((deckId) => (remaining.get(deckId) ?? 0) <= 0)) continue;
        for (const deckId of chain) {
          remaining.set(deckId, (remaining.get(deckId) ?? 0) - 1);
        }
        taken.push(card);
      }
      return { taken, count: taken.length };
    },
  };
}

export function buildQueue(input: BuildQueueInput): BuildQueueResult {
  const { candidates, plan, config, now, day, deckOrder } = input;
  const random = input.random ?? Math.random;

  const dayEnd = getFlashcardDayEnd(now, day).getTime();
  const studiable = candidates.filter(
    (card) => isStudiable(card) && plan.budgets.has(card.deckId),
  );

  // --- Pemisahan kelompok ---------------------------------------------------
  const intraday: QueueEntry[] = [];
  const interday: QueueEntry[] = [];
  const review: QueueEntry[] = [];
  const fresh: QueueCandidate[] = [];

  for (const card of studiable) {
    if (card.queue === "NEW") {
      fresh.push(card);
      continue;
    }
    // Kartu review dan learning yang jatuh tempo kapan pun hari ini ikut masuk,
    // bukan hanya yang sudah lewat `now` — inilah yang membuat kartu ber-rating
    // Again bisa kembali dalam sesi yang sama tanpa reload.
    if (card.due.getTime() >= dayEnd) continue;

    if (card.queue === "LEARNING") intraday.push({ ...card, group: "intradayLearning" });
    else if (card.queue === "DAY_LEARN") interday.push({ ...card, group: "interdayLearning" });
    else review.push({ ...card, group: "review" });
  }

  // --- Limit ----------------------------------------------------------------
  // Kartu intraday learning tidak pernah dibatasi. Interday learning dan review
  // berbagi review limit, dengan interday learning diambil lebih dulu.
  const reviewAllocator = makeAllocator(plan, "reviewLimit");
  const newAllocator = makeAllocator(plan, "newLimit");

  intraday.sort((left, right) => left.due.getTime() - right.due.getTime());

  const interdayTaken = reviewAllocator.take(
    [...interday].sort((left, right) => left.due.getTime() - right.due.getTime()),
  ).taken;

  const reviewTaken = reviewAllocator.take(
    sortReviewCards(review, config, now, deckOrder, random).map((card) => ({
      ...card,
      group: "review" as const,
    })),
  ).taken;

  const gatheredNew = gatherNewCards(fresh, config, deckOrder, random);
  const sortedNew = sortNewCards(gatheredNew, config, random).map((card) => ({
    ...card,
    group: "new" as const,
  }));

  let newTaken = newAllocator.take(sortedNew).taken;
  if (!config.newCardsIgnoreReviewLimit) {
    // Secara default kartu baru ikut memakan review limit, sehingga backlog review
    // otomatis menahan masuknya kartu baru.
    newTaken = reviewAllocator.take(newTaken).taken;
  }

  // --- Burying ---------------------------------------------------------------
  // Penting: burying diputuskan pada URUTAN PENGAMBILAN, bukan urutan tampil.
  // Kalau dijalankan setelah display order, kartu baru yang kebetulan tampil
  // lebih dulu (mis. newReviewOrder "mix") akan mem-bury kartu review-nya —
  // kebalikan dari aturan Anki bahwa tipe yang lebih belakang tidak bisa
  // mem-bury tipe yang lebih depan.
  const gatherOrdered: QueueEntry[] = [
    ...intraday,
    ...interdayTaken,
    ...reviewTaken,
    ...newTaken,
  ];
  const { queue: kept, buried } = applySiblingBurying(gatherOrdered, config);
  const keptIds = new Set(kept.map((entry) => entry.cardId));
  const survives = (entry: QueueEntry) => keptIds.has(entry.cardId);

  const keptIntraday = intraday.filter(survives);
  const keptInterday = interdayTaken.filter(survives);
  const keptReview = reviewTaken.filter(survives);
  const keptNew = newTaken.filter(survives);

  // --- Penggabungan sesuai display order ------------------------------------
  const reviewSection = mergeByOrder(
    keptInterday,
    keptReview,
    config.interdayLearningReviewOrder,
    random,
  );
  const merged = mergeByOrder(keptNew, reviewSection, config.newReviewOrder, random);

  return {
    queue: [...keptIntraday, ...merged],
    buried,
    counts: {
      intradayLearning: keptIntraday.length,
      interdayLearning: keptInterday.length,
      review: keptReview.length,
      new: keptNew.length,
    },
  };
}

/**
 * `first` adalah kelompok yang diatur opsinya (kartu baru, atau interday learning);
 * `second` adalah kartu review yang menjadi acuannya.
 */
function mergeByOrder(
  first: QueueEntry[],
  second: QueueEntry[],
  order: "mix" | "afterReviews" | "beforeReviews",
  random: RandomFn,
): QueueEntry[] {
  if (order === "beforeReviews") return [...first, ...second];
  if (order === "afterReviews") return [...second, ...first];
  if (first.length === 0) return [...second];
  if (second.length === 0) return [...first];

  // "mix": sebar merata, bukan diacak, supaya jaraknya konsisten seperti Anki.
  const total = first.length + second.length;
  const result: QueueEntry[] = [];
  let firstIndex = 0;
  let secondIndex = 0;

  for (let slot = 0; slot < total; slot += 1) {
    const takeFirst =
      secondIndex >= second.length ||
      (firstIndex < first.length &&
        (firstIndex + 0.5) / first.length <= (secondIndex + 0.5) / second.length);
    result.push(takeFirst ? first[firstIndex++]! : second[secondIndex++]!);
  }

  void random;
  return result;
}
