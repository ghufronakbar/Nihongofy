import type { FlashcardConfig } from "../../schemas";
import { getRetrievability } from "../scheduler/fsrs";
import { getFlashcardDayStart, type FlashcardDayContext } from "../scheduler/day";
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

// --- Posisi kartu baru -------------------------------------------------------

const LEVEL_RANK: Record<string, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
const LEVEL_SPAN = 100_000;

/**
 * Posisi kartu baru menurut insertion order Anki.
 *
 * Kartu belum disimpan sampai pertama kali disentuh, jadi posisinya dihitung,
 * bukan dibaca: "sequential" mengikuti urutan katalog (level termudah dulu,
 * lalu urutan daftar sumbernya), "random" memakai hash per user sehingga
 * acakannya stabil antar sesi — sama seperti Anki yang mengacak posisi sekali
 * saat kartu ditambahkan. Mengganti opsi ini langsung berlaku untuk semua kartu
 * baru, persis perilaku Anki saat insertion order preset diubah.
 */
export function insertionPosition(
  insertionOrder: FlashcardConfig["insertionOrder"],
  userId: number,
  vocab: { id: number; level: string; order: number },
): number {
  if (insertionOrder === "random") {
    // FNV-1a 32-bit atas "userId:vocabId".
    let hash = 0x811c9dc5;
    for (const char of `${userId}:${vocab.id}`) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
  return (LEVEL_RANK[vocab.level] ?? 5) * LEVEL_SPAN + vocab.order;
}

// --- Kartu baru --------------------------------------------------------------

const byPosition = (left: QueueCandidate, right: QueueCandidate) =>
  left.position - right.position || left.vocabId - right.vocabId;

/**
 * Urutan pengambilan kartu baru. Deck bawaan tidak punya subdeck dan satu kata
 * hanya menghasilkan satu kartu, jadi opsi Anki yang membedakan subdeck atau
 * note bersaudara jatuh ke padanan terdekatnya.
 */
export function gatherNewCards(
  cards: QueueCandidate[],
  config: FlashcardConfig,
  random: RandomFn,
): QueueCandidate[] {
  switch (config.newCardGatherOrder) {
    case "descendingPosition":
      return [...cards].sort((left, right) => byPosition(right, left));

    case "randomCards":
    case "randomNotes":
    case "deckThenRandomNotes":
      return shuffle(cards, random);

    default:
      // "deck" dan "ascendingPosition".
      return [...cards].sort(byPosition);
  }
}

/** Urutan tampil kartu baru, diterapkan setelah pengambilan. */
export function sortNewCards(
  gathered: QueueCandidate[],
  config: FlashcardConfig,
  random: RandomFn,
): QueueCandidate[] {
  switch (config.newCardSortOrder) {
    case "random":
    case "cardTemplateThenRandom":
    case "randomNoteThenTemplate":
      return shuffle(gathered, random);

    default:
      // "gather" dan "templateThenGather" (hanya ada satu template kartu).
      return [...gathered];
  }
}

// --- Kartu review ------------------------------------------------------------

function retrievabilityScores(
  cards: QueueCandidate[],
  config: FlashcardConfig,
  now: Date,
): Map<number, number> {
  return new Map(
    cards.map((card) => [
      card.vocabId,
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
}

/**
 * "Ease" kartu untuk urutan ascending/descending ease. Dengan FSRS tidak ada
 * ease factor; padanannya difficulty yang arahnya terbalik (makin sulit =
 * makin kecil ease), seperti label "difficulty" di Anki saat FSRS aktif.
 */
function easeOf(card: QueueCandidate, config: FlashcardConfig) {
  if (config.fsrsEnabled) return -(card.difficulty ?? 0);
  return card.easeFactor ?? config.startingEase;
}

export function sortReviewCards(
  cards: QueueCandidate[],
  config: FlashcardConfig,
  now: Date,
  day: FlashcardDayContext,
  random: RandomFn,
): QueueCandidate[] {
  // Anki menyimpan due review sebagai nomor hari, jadi "due date" berarti hari
  // jatuh tempo, bukan jam: kartu yang jatuh tempo di hari yang sama diacak.
  const dueDay = (card: QueueCandidate) => getFlashcardDayStart(card.due, day).getTime();
  const byDueDay = (left: QueueCandidate, right: QueueCandidate) => dueDay(left) - dueDay(right);

  switch (config.reviewSortOrder) {
    case "ascendingIntervals":
      return [...cards].sort((left, right) => left.intervalDays - right.intervalDays);

    case "descendingIntervals":
      return [...cards].sort((left, right) => right.intervalDays - left.intervalDays);

    case "ascendingEase":
      return [...cards].sort((left, right) => easeOf(left, config) - easeOf(right, config));

    case "descendingEase":
      return [...cards].sort((left, right) => easeOf(right, config) - easeOf(left, config));

    case "ascendingRetrievability": {
      // Kartu yang paling berisiko sudah terlupa lebih dulu.
      const scores = retrievabilityScores(cards, config, now);
      return [...cards].sort(
        (left, right) => (scores.get(left.vocabId) ?? 0) - (scores.get(right.vocabId) ?? 0),
      );
    }

    case "descendingRetrievability": {
      // Kartu yang paling mungkin masih diingat lebih dulu.
      const scores = retrievabilityScores(cards, config, now);
      return [...cards].sort(
        (left, right) => (scores.get(right.vocabId) ?? 0) - (scores.get(left.vocabId) ?? 0),
      );
    }

    case "random":
      return shuffle(cards, random);

    default:
      // "dueDateThenRandom", "dueDateThenDeck", dan "deckThenDueDate" — tanpa
      // subdeck, ketiganya sama: hari jatuh tempo, lalu acak di dalam hari itu.
      return shuffle(cards, random).sort(byDueDay);
  }
}
