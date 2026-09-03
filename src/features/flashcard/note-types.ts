import type { FlashcardNoteTypeKind } from "@prisma/client";

/**
 * Note type didefinisikan aplikasi, bukan user.
 *
 * Anki membiarkan user menulis template HTML/CSS sendiri (`qfmt`/`afmt`). Kita
 * sengaja tidak: tata letak kartu milik aplikasi supaya desainnya konsisten dan
 * tidak ada HTML asing yang bisa merusak UI atau menyuntikkan script.
 *
 * Yang TETAP kita tiru dari Anki adalah relasi note -> banyak card. Satu note
 * menghasilkan beberapa card (`ord` = index di `cardTemplates`), dan card-card
 * bersaudara itulah yang menjadi dasar fitur burying di scheduler.
 */

export type FlashcardFieldDef = {
  /** Key stabil; dipakai layout dan mapping import, tidak boleh berubah. */
  key: string;
  label: string;
  /** Note tanpa isi di field ini ditolak saat import. */
  required: boolean;
  /** Field yang dipakai untuk dedup + tampil di card browser. */
  isSortField?: boolean;
  /** Field berisi teks Jepang; dirender dengan font & parsing furigana. */
  japanese?: boolean;
  multiline?: boolean;
};

export type FlashcardCardTemplateDef = {
  ord: number;
  name: string;
  /** Field yang tampil di sisi soal. */
  front: string[];
  /** Field yang tampil di sisi jawaban. */
  back: string[];
};

export type FlashcardNoteTypeDef = {
  kind: FlashcardNoteTypeKind;
  label: string;
  description: string;
  fields: FlashcardFieldDef[];
  /**
   * Jumlah card per note bersifat tetap, KECUALI untuk CLOZE yang jumlahnya
   * ditentukan isi field (`{{c1::}}`..`{{cN::}}`) dan dihitung saat import.
   */
  cardTemplates: FlashcardCardTemplateDef[];
  isCloze: boolean;
};

export const FLASHCARD_NOTE_TYPES: Record<FlashcardNoteTypeKind, FlashcardNoteTypeDef> = {
  BASIC: {
    kind: "BASIC",
    label: "Basic",
    description: "Satu sisi soal, satu sisi jawaban.",
    isCloze: false,
    fields: [
      { key: "front", label: "Depan", required: true, isSortField: true, multiline: true },
      { key: "back", label: "Belakang", required: true, multiline: true },
    ],
    cardTemplates: [{ ord: 0, name: "Depan → Belakang", front: ["front"], back: ["back"] }],
  },

  BASIC_REVERSED: {
    kind: "BASIC_REVERSED",
    label: "Basic (dua arah)",
    description: "Menghasilkan dua kartu: depan→belakang dan belakang→depan.",
    isCloze: false,
    fields: [
      { key: "front", label: "Depan", required: true, isSortField: true, multiline: true },
      { key: "back", label: "Belakang", required: true, multiline: true },
    ],
    cardTemplates: [
      { ord: 0, name: "Depan → Belakang", front: ["front"], back: ["back"] },
      { ord: 1, name: "Belakang → Depan", front: ["back"], back: ["front"] },
    ],
  },

  VOCAB_JP: {
    kind: "VOCAB_JP",
    label: "Kosakata Jepang",
    description: "Kata, bacaan, arti, dan contoh kalimat. Menghasilkan dua kartu.",
    isCloze: false,
    fields: [
      { key: "word", label: "Kata", required: true, isSortField: true, japanese: true },
      { key: "reading", label: "Bacaan", required: false, japanese: true },
      { key: "meaning", label: "Arti", required: true, multiline: true },
      { key: "example", label: "Contoh", required: false, japanese: true, multiline: true },
      { key: "exampleMeaning", label: "Arti contoh", required: false, multiline: true },
      { key: "note", label: "Catatan", required: false, multiline: true },
    ],
    cardTemplates: [
      {
        ord: 0,
        name: "Kata → Arti",
        front: ["word"],
        back: ["reading", "meaning", "example", "exampleMeaning", "note"],
      },
      {
        ord: 1,
        name: "Arti → Kata",
        front: ["meaning"],
        back: ["word", "reading", "example", "exampleMeaning", "note"],
      },
    ],
  },

  KANJI: {
    kind: "KANJI",
    label: "Kanji",
    description: "Kanji dengan onyomi, kunyomi, arti, dan contoh. Menghasilkan dua kartu.",
    isCloze: false,
    fields: [
      { key: "kanji", label: "Kanji", required: true, isSortField: true, japanese: true },
      { key: "onyomi", label: "Onyomi", required: false, japanese: true },
      { key: "kunyomi", label: "Kunyomi", required: false, japanese: true },
      { key: "meaning", label: "Arti", required: true, multiline: true },
      { key: "example", label: "Contoh", required: false, japanese: true, multiline: true },
    ],
    cardTemplates: [
      {
        ord: 0,
        name: "Kanji → Arti & bacaan",
        front: ["kanji"],
        back: ["meaning", "onyomi", "kunyomi", "example"],
      },
      {
        ord: 1,
        name: "Arti → Kanji",
        front: ["meaning"],
        back: ["kanji", "onyomi", "kunyomi", "example"],
      },
    ],
  },

  KANA: {
    kind: "KANA",
    label: "Kana",
    description: "Satu huruf hiragana/katakana dan cara bacanya. Menghasilkan dua kartu.",
    isCloze: false,
    fields: [
      { key: "char", label: "Huruf", required: true, isSortField: true, japanese: true },
      { key: "romaji", label: "Romaji", required: true },
      { key: "example", label: "Contoh kata", required: false, japanese: true },
    ],
    cardTemplates: [
      { ord: 0, name: "Huruf → Romaji", front: ["char"], back: ["romaji", "example"] },
      { ord: 1, name: "Romaji → Huruf", front: ["romaji"], back: ["char", "example"] },
    ],
  },

  CLOZE: {
    kind: "CLOZE",
    label: "Cloze",
    description:
      "Teks dengan bagian yang disembunyikan, mis. 日本語を{{c1::勉強}}する。 Satu kartu per nomor cloze.",
    isCloze: true,
    fields: [
      { key: "text", label: "Teks", required: true, isSortField: true, japanese: true, multiline: true },
      { key: "note", label: "Catatan", required: false, multiline: true },
    ],
    // Diisi saat import berdasarkan jumlah c1..cN di field `text`.
    cardTemplates: [],
  },
};

export const FLASHCARD_NOTE_TYPE_KINDS = Object.keys(
  FLASHCARD_NOTE_TYPES,
) as FlashcardNoteTypeKind[];

export function getNoteType(kind: FlashcardNoteTypeKind): FlashcardNoteTypeDef {
  return FLASHCARD_NOTE_TYPES[kind];
}

export function getFieldIndex(kind: FlashcardNoteTypeKind, fieldKey: string): number {
  return FLASHCARD_NOTE_TYPES[kind].fields.findIndex((field) => field.key === fieldKey);
}

/** Field yang dipakai untuk dedup saat import tanpa GUID (padanan `sfld` di Anki). */
export function getSortFieldIndex(kind: FlashcardNoteTypeKind): number {
  const index = FLASHCARD_NOTE_TYPES[kind].fields.findIndex((field) => field.isSortField);
  return index === -1 ? 0 : index;
}

const CLOZE_PATTERN = /\{\{c(\d{1,3})::/g;

/** Nomor cloze unik yang ada di teks, terurut. Anki memberi satu kartu per nomor. */
export function extractClozeOrdinals(text: string): number[] {
  const ordinals = new Set<number>();
  for (const match of text.matchAll(CLOZE_PATTERN)) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value >= 1) ordinals.add(value);
  }
  return [...ordinals].sort((a, b) => a - b);
}

/**
 * Berapa kartu yang dihasilkan satu note. Untuk non-cloze ini konstan; untuk
 * cloze bergantung isi field, dan note cloze tanpa `{{cN::}}` tidak menghasilkan
 * kartu sama sekali (sama seperti Anki).
 */
export function countCardsForNote(
  kind: FlashcardNoteTypeKind,
  fields: readonly string[],
): number {
  const noteType = FLASHCARD_NOTE_TYPES[kind];
  if (!noteType.isCloze) return noteType.cardTemplates.length;

  const textIndex = getFieldIndex(kind, "text");
  return extractClozeOrdinals(fields[textIndex] ?? "").length;
}
