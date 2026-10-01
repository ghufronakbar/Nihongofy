import type { FlashcardRatingInput } from "../schemas";
import type { ReviewerCardKind, StudyCounts } from "../types";

/**
 * Hitungan layar belajar dan ringkasan akhir sesi.
 *
 * Murni dan tanpa React supaya bisa diuji: reviewer hanya menyimpan daftar
 * jawaban sesi, semua angka diturunkan dari sini. Karena turunannya selalu
 * dihitung ulang dari daftar itu, undo cukup membuang jawaban terakhir.
 */

export type SessionAnswer = {
  vocabId: number;
  wordPlain: string;
  /** Jenis kartu saat dijawab, bukan sesudahnya. */
  kind: ReviewerCardKind;
  rating: FlashcardRatingInput;
  takenMs: number;
  /** Epoch ms. */
  answeredAt: number;
  /** Epoch ms jadwal berikutnya; null di mode coba yang tidak menjadwalkan. */
  dueAt: number | null;
  becameLeech: boolean;
};

export const EMPTY_STUDY_COUNTS: StudyCounts = { new: 0, learning: 0, review: 0 };

export function countByKind(
  cards: readonly { kind: ReviewerCardKind }[],
  base: StudyCounts = EMPTY_STUDY_COUNTS,
): StudyCounts {
  const counts = { ...base };
  for (const card of cards) counts[card.kind] += 1;
  return counts;
}

const MOST_MISSED_LIMIT = 5;

export type MissedCard = { vocabId: number; wordPlain: string; again: number };

export type SessionSummary = {
  /** Jumlah jawaban; kartu yang diulang dalam sesi dihitung tiap kali dijawab. */
  total: number;
  uniqueCards: number;
  /** Kartu baru yang pertama kali dijawab di sesi ini. */
  newLearned: number;
  ratings: Record<FlashcardRatingInput, number>;
  /** Proporsi jawaban selain Again; null bila belum ada jawaban. */
  correctRate: number | null;
  /** Total waktu menjawab (kartu tampil sampai tombol ditekan). */
  answerMs: number;
  averageSeconds: number | null;
  /** Dari kartu pertama tampil sampai jawaban terakhir, termasuk jeda. */
  durationMs: number;
  /** Kartu dengan Again terbanyak, maksimal lima. */
  mostMissed: MissedCard[];
  leeches: { vocabId: number; wordPlain: string }[];
};

export function summarizeSession(answers: readonly SessionAnswer[]): SessionSummary {
  const ratings: Record<FlashcardRatingInput, number> = { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 };
  const missed = new Map<number, MissedCard>();
  const leeches = new Map<number, string>();
  let answerMs = 0;
  let timed = 0;

  for (const answer of answers) {
    ratings[answer.rating] += 1;
    if (answer.takenMs > 0) {
      answerMs += answer.takenMs;
      timed += 1;
    }
    if (answer.rating === "AGAIN") {
      const entry = missed.get(answer.vocabId);
      if (entry) entry.again += 1;
      else missed.set(answer.vocabId, { vocabId: answer.vocabId, wordPlain: answer.wordPlain, again: 1 });
    }
    if (answer.becameLeech) leeches.set(answer.vocabId, answer.wordPlain);
  }

  const total = answers.length;
  const first = answers[0];
  const last = answers[total - 1];

  return {
    total,
    uniqueCards: new Set(answers.map((answer) => answer.vocabId)).size,
    newLearned: answers.filter((answer) => answer.kind === "new").length,
    ratings,
    correctRate: total === 0 ? null : (total - ratings.AGAIN) / total,
    answerMs,
    averageSeconds: timed === 0 ? null : answerMs / timed / 1_000,
    durationMs:
      first && last ? Math.max(0, last.answeredAt - (first.answeredAt - first.takenMs)) : 0,
    // Stabil untuk hitungan yang sama: urutan pertama kali terlupa.
    mostMissed: [...missed.values()]
      .sort((left, right) => right.again - left.again)
      .slice(0, MOST_MISSED_LIMIT),
    leeches: [...leeches].map(([vocabId, wordPlain]) => ({ vocabId, wordPlain })),
  };
}

/**
 * Kartu sesi ini yang jadwal terakhirnya jatuh di `[startMs, endMs)`. Hanya
 * jawaban terakhir tiap kartu yang dihitung: kartu learning yang dijawab tiga
 * kali hari ini cuma punya satu jadwal yang berlaku.
 */
export function countDueInWindow(
  answers: readonly SessionAnswer[],
  startMs: number,
  endMs: number,
): number {
  const latest = new Map<number, number | null>();
  for (const answer of answers) latest.set(answer.vocabId, answer.dueAt);

  let count = 0;
  for (const dueAt of latest.values()) {
    if (dueAt !== null && dueAt >= startMs && dueAt < endMs) count += 1;
  }
  return count;
}

/** "4m 05d" / "45d" — durasi ringkas untuk ringkasan sesi. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}j ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}d`;
  return `${seconds}d`;
}
