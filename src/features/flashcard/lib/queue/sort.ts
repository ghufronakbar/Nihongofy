import type { FlashcardPresetConfig } from "../../schemas";
import { getRetrievability } from "../scheduler/fsrs";
import type { QueueCandidate } from "./types";

export type RandomFn = () => number;

/** Fisher-Yates dengan sumber acak yang bisa disuntik supaya test deterministik. */
export function shuffle<T>(items: T[], random: RandomFn): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function groupByNote(cards: QueueCandidate[]): QueueCandidate[][] {
  const byNote = new Map<string, QueueCandidate[]>();
  for (const card of cards) {
    const existing = byNote.get(card.noteId);
    if (existing) existing.push(card);
    else byNote.set(card.noteId, [card]);
  }
  return [...byNote.values()];
}

// --- Kartu baru --------------------------------------------------------------

/**
 * Urutan pengambilan kartu baru. Perhatikan bahwa "deck" berarti subdeck diambil
 * berurutan dari atas, dan di dalam tiap subdeck memakai ascending position.
 */
export function gatherNewCards(
  cards: QueueCandidate[],
  config: FlashcardPresetConfig,
  deckOrder: Map<number, number>,
  random: RandomFn,
): QueueCandidate[] {
  const byPosition = (left: QueueCandidate, right: QueueCandidate) =>
    left.position - right.position || Number(left.cardId) - Number(right.cardId);
  const deckRank = (card: QueueCandidate) => deckOrder.get(card.deckId) ?? Number.MAX_SAFE_INTEGER;

  switch (config.newCardGatherOrder) {
    case "ascendingPosition":
      return [...cards].sort(byPosition);

    case "descendingPosition":
      return [...cards].sort((left, right) => byPosition(right, left));

    case "randomCards":
      return shuffle(cards, random);

    case "randomNotes":
      return shuffle(groupByNote(cards), random).flatMap((siblings) =>
        [...siblings].sort((left, right) => left.ord - right.ord),
      );

    case "deckThenRandomNotes":
      return shuffle(groupByNote(cards), random)
        .flatMap((siblings) => [...siblings].sort((left, right) => left.ord - right.ord))
        .sort((left, right) => deckRank(left) - deckRank(right));

    default:
      // "deck": subdeck berurutan, di dalamnya ascending position.
      return [...cards].sort(
        (left, right) => deckRank(left) - deckRank(right) || byPosition(left, right),
      );
  }
}

/** Urutan tampil kartu baru, diterapkan setelah pengambilan. */
export function sortNewCards(
  gathered: QueueCandidate[],
  config: FlashcardPresetConfig,
  random: RandomFn,
): QueueCandidate[] {
  const gatherIndex = new Map(gathered.map((card, index) => [card.cardId, index]));
  const byGather = (left: QueueCandidate, right: QueueCandidate) =>
    (gatherIndex.get(left.cardId) ?? 0) - (gatherIndex.get(right.cardId) ?? 0);

  switch (config.newCardSortOrder) {
    case "gather":
      return [...gathered];

    case "random":
      return shuffle(gathered, random);

    case "cardTemplateThenRandom": {
      const byOrd = new Map<number, QueueCandidate[]>();
      for (const card of gathered) {
        const bucket = byOrd.get(card.ord);
        if (bucket) bucket.push(card);
        else byOrd.set(card.ord, [card]);
      }
      return [...byOrd.keys()]
        .sort((left, right) => left - right)
        .flatMap((ord) => shuffle(byOrd.get(ord)!, random));
    }

    case "randomNoteThenTemplate":
      return shuffle(groupByNote(gathered), random).flatMap((siblings) =>
        [...siblings].sort((left, right) => left.ord - right.ord),
      );

    default:
      // "templateThenGather": semua kartu template 0 lebih dulu, lalu template 1, dst.
      return [...gathered].sort((left, right) => left.ord - right.ord || byGather(left, right));
  }
}

// --- Kartu review ------------------------------------------------------------

export function sortReviewCards(
  cards: QueueCandidate[],
  config: FlashcardPresetConfig,
  now: Date,
  deckOrder: Map<number, number>,
  random: RandomFn,
): QueueCandidate[] {
  const deckRank = (card: QueueCandidate) => deckOrder.get(card.deckId) ?? Number.MAX_SAFE_INTEGER;
  const byDue = (left: QueueCandidate, right: QueueCandidate) =>
    left.due.getTime() - right.due.getTime();

  switch (config.reviewSortOrder) {
    case "dueDateThenDeck":
      return [...cards].sort((left, right) => byDue(left, right) || deckRank(left) - deckRank(right));

    case "deckThenDueDate":
      return [...cards].sort((left, right) => deckRank(left) - deckRank(right) || byDue(left, right));

    case "ascendingIntervals":
      return [...cards].sort((left, right) => left.intervalDays - right.intervalDays);

    case "descendingIntervals":
      return [...cards].sort((left, right) => right.intervalDays - left.intervalDays);

    case "ascendingEase":
      return [...cards].sort(
        (left, right) => (left.easeFactor ?? 0) - (right.easeFactor ?? 0),
      );

    case "descendingEase":
      return [...cards].sort(
        (left, right) => (right.easeFactor ?? 0) - (left.easeFactor ?? 0),
      );

    case "relativeOverdueness": {
      // Dengan FSRS aktif inilah "ascending retrievability": kartu yang paling
      // berisiko sudah terlupakan ditampilkan lebih dulu.
      const scores = new Map(
        cards.map((card) => [
          card.cardId,
          getRetrievability(
            {
              type: card.type,
              queue: card.queue,
              due: card.due,
              intervalDays: card.intervalDays,
              reps: card.reps,
              lapses: card.lapses,
              learningStep: card.learningStep,
              stability: card.stability,
              difficulty: card.difficulty,
              desiredRetention: null,
              easeFactor: card.easeFactor,
              lastReviewedAt: card.lastReviewedAt,
            },
            now,
            config,
          ),
        ]),
      );
      return [...cards].sort(
        (left, right) => (scores.get(left.cardId) ?? 0) - (scores.get(right.cardId) ?? 0),
      );
    }

    default: {
      // "dueDateThenRandom"
      const shuffled = shuffle(cards, random);
      return shuffled.sort(byDue);
    }
  }
}
