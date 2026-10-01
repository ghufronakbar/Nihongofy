import type { FlashcardRatingInput } from "./schemas";
import type { FlashcardTagView } from "./taxonomy";

/**
 * Tipe yang dipakai bersama server dan komponen client. Sengaja terpisah dari
 * data.ts (server-only) supaya komponen client tidak ikut menarik kode server.
 */

export type VocabExample = { jp: string; id: string; en: string };

export type VocabCardContent = {
  level: string;
  /** Bermarkup furigana {漢字|かな}; dipakai di sisi belakang. */
  word: string;
  /** Tanpa furigana; satu-satunya isi sisi depan. */
  wordPlain: string;
  reading: string;
  meaningsId: string[];
  meaningsEn: string[];
  examples: VocabExample[];
  notes: string;
  tags: FlashcardTagView[];
};

export type PreviewLabels = Record<FlashcardRatingInput, string>;

export type ReviewerCard = {
  vocabId: number;
  isNew: boolean;
  content: VocabCardContent;
  /** Interval yang akan didapat tiap tombol, sudah dihitung server. */
  previewLabels: PreviewLabels;
};

/** Kartu learning yang jatuh tempo nanti hari ini, ditahan reviewer sampai waktunya. */
export type PendingLearningCard = ReviewerCard & { dueAt: string };

export type DeckKind = "LEVEL" | "TOPIC" | "CATEGORY";

export type DeckSummary = {
  id: number;
  slug: string;
  kind: DeckKind;
  name: string;
  nameJa: string;
  description: string;
  wordCount: number;
};

/** Hitungan hari ini yang ditampilkan di daftar deck, sudah dipotong batas harian. */
export type DeckDueCounts = {
  newCount: number;
  learningCount: number;
  reviewCount: number;
  /** Kartu learning yang baru jatuh tempo nanti hari ini. */
  learningLaterCount: number;
};

export type DeckWordStatus = "new" | "learning" | "review" | "suspended";

export type DeckWord = {
  vocabId: number;
  level: string;
  wordPlain: string;
  word: string;
  reading: string;
  meaningsId: string[];
  status: DeckWordStatus;
  isBuried: boolean;
  isLeech: boolean;
  hasCard: boolean;
  /** ISO; null untuk kartu baru. */
  due: string | null;
  intervalDays: number;
};
