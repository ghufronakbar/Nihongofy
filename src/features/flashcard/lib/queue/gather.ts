import type { FlashcardConfig } from "../../schemas";
import { getFlashcardDayEnd, type FlashcardDayContext } from "../scheduler/day";
import { gatherNewCards, sortNewCards, sortReviewCards, type RandomFn } from "./sort";
import type { QueueBudget, QueueCandidate, QueueCounts, QueueEntry } from "./types";

/**
 * Membangun antrean belajar sesuai scheduler v3 Anki.
 *
 * Urutan pengambilan tetap: intraday learning -> interday learning -> review ->
 * new. Urutan itu bukan sekadar preferensi tampilan — ia menentukan bagian
 * mana dari review limit yang terpakai lebih dulu. Urutan tampil diterapkan
 * sesudahnya lewat newReviewOrder dan interdayLearningReviewOrder.
 */

export type BuildQueueInput = {
  /** Sudah tanpa kartu suspended/tertunda; kartu baru dan kartu jatuh tempo. */
  candidates: QueueCandidate[];
  budget: QueueBudget;
  config: FlashcardConfig;
  now: Date;
  day: FlashcardDayContext;
  random?: RandomFn;
};

export type BuildQueueResult = {
  queue: QueueEntry[];
  /**
   * Kartu learning yang belum jatuh tempo tetapi masih hari ini, urut dari yang
   * terdekat. Reviewer menampilkannya saat jatuh tempo, atau lebih awal (learn
   * ahead) hanya bila tidak ada kartu lain.
   */
  laterLearning: QueueEntry[];
  counts: QueueCounts;
};

export function buildQueue(input: BuildQueueInput): BuildQueueResult {
  const { candidates, budget, config, now, day } = input;
  const random = input.random ?? Math.random;
  const dayEnd = getFlashcardDayEnd(now, day).getTime();

  const intraday: QueueEntry[] = [];
  const laterLearning: QueueEntry[] = [];
  const interday: QueueEntry[] = [];
  const review: QueueCandidate[] = [];
  const fresh: QueueCandidate[] = [];

  for (const card of candidates) {
    if (card.queue === "NEW") {
      fresh.push(card);
      continue;
    }
    // Interday learning dan review jatuh tempo per HARI (seperti Anki yang
    // menyimpannya sebagai nomor hari), jadi seluruh yang due hari ini ikut.
    // Intraday learning jatuh tempo per MENIT: yang belum waktunya ditahan,
    // termasuk yang masih di dalam batas learn ahead. Learn ahead hanya berlaku
    // saat tidak ada kartu lain (Anki: "when there is nothing left to study"),
    // dan itu keputusan reviewer, bukan urutan antrean. Menaruhnya di depan
    // antrean membuat kartu yang baru dijawab Again (1m) langsung tampil lagi.
    if (card.due.getTime() >= dayEnd) continue;

    if (card.queue === "LEARNING") {
      const entry: QueueEntry = { ...card, group: "intradayLearning" };
      if (card.due.getTime() <= now.getTime()) intraday.push(entry);
      else laterLearning.push(entry);
    } else if (card.queue === "DAY_LEARN") {
      interday.push({ ...card, group: "interdayLearning" });
    } else {
      review.push(card);
    }
  }

  // --- Limit ----------------------------------------------------------------
  // Intraday learning tidak pernah dibatasi. Interday learning dan review
  // berbagi review limit, dengan interday learning diambil lebih dulu.
  let reviewLeft = Math.max(0, budget.reviewLimit);

  intraday.sort((left, right) => left.due.getTime() - right.due.getTime());
  laterLearning.sort((left, right) => left.due.getTime() - right.due.getTime());

  const interdayTaken = interday
    .sort((left, right) => left.due.getTime() - right.due.getTime())
    .slice(0, reviewLeft);
  reviewLeft -= interdayTaken.length;

  const reviewTaken: QueueEntry[] = sortReviewCards(review, config, now, day, random)
    .slice(0, reviewLeft)
    .map((card) => ({ ...card, group: "review" as const }));
  reviewLeft -= reviewTaken.length;

  // Secara default kartu baru ikut memakan sisa review limit, sehingga
  // tumpukan review otomatis menahan masuknya kartu baru.
  const newAllowed = config.newCardsIgnoreReviewLimit
    ? Math.max(0, budget.newLimit)
    : Math.max(0, Math.min(budget.newLimit, reviewLeft));

  const newTaken: QueueEntry[] = sortNewCards(
    gatherNewCards(fresh, config, random).slice(0, newAllowed),
    config,
    random,
  ).map((card) => ({ ...card, group: "new" as const }));

  // --- Penggabungan sesuai display order ------------------------------------
  const reviewSection = mergeByOrder(interdayTaken, reviewTaken, config.interdayLearningReviewOrder);
  const merged = mergeByOrder(newTaken, reviewSection, config.newReviewOrder);

  return {
    queue: [...intraday, ...merged],
    laterLearning,
    counts: {
      intradayLearning: intraday.length,
      interdayLearning: interdayTaken.length,
      review: reviewTaken.length,
      new: newTaken.length,
    },
  };
}

/**
 * `first` adalah kelompok yang diatur opsinya (kartu baru, atau interday
 * learning); `second` adalah kartu review yang menjadi acuannya.
 */
function mergeByOrder(
  first: QueueEntry[],
  second: QueueEntry[],
  order: "mix" | "afterReviews" | "beforeReviews",
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

  return result;
}
