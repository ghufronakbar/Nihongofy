import type { ReportCategoryValue } from "../constants";

// Kartu flashcard sebagai target laporan. Isi kartu TIDAK diedit dari admin:
// katalog diisi `seed:flashcard` dari src/flashcard-data/vocab/<level>.json, jadi
// perbaikannya dilakukan di fixture itu. Helper di sini menyusun label snapshot
// dan petunjuk perbaikan dari identitas kata (`key`), satu-satunya hal yang
// menghubungkan baris katalog dengan entri fixture-nya.
//
// Sengaja tanpa "server-only" dan tanpa impor `@/constants`: layar admin dan
// action laporan sama-sama memakainya, dan isinya fungsi murni yang diuji unit.

type VocabIdentity = { key: string; level: string };

/**
 * Snapshot `Report.targetLabel`, mis. "Flashcard · N5 · 食事|しょくじ".
 *
 * Memuat `key` utuh, bukan hanya tulisan katanya: bila FK-nya kelak menjadi NULL,
 * key inilah yang masih menunjuk entri fixture yang perlu diperbaiki. Key juga
 * membuat pencarian antrean admin bekerja untuk tulisan, bacaan, maupun key.
 */
export function flashcardReportLabel({ key, level }: VocabIdentity) {
  return `Flashcard · ${level} · ${key}`;
}

/** Fixture tempat kata ini disunting, mis. `src/flashcard-data/vocab/n5.json`. */
export function flashcardFixtureFile(level: string) {
  return `src/flashcard-data/vocab/${level.toLowerCase()}.json`;
}

/**
 * Argumen shell untuk sebuah key. Kutip ganda seperti contoh di
 * docs/seed-flashcard.md; kutip tunggal hanya bila key memuat karakter yang tetap
 * ditafsirkan shell di dalam kutip ganda.
 */
export function shellQuote(value: string) {
  if (!/["\\$`!]/.test(value)) return `"${value}"`;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function flashcardRegenerateCommand(key: string) {
  return `npm run gen:flashcard -- --key ${shellQuote(key)} --overwrite`;
}

export const FLASHCARD_SEED_COMMANDS = [
  "npm run seed:flashcard:check",
  "npm run seed:flashcard",
] as const;

export type FlashcardCategoryNote = { text: string; commands: string[] };

/**
 * Catatan tambahan per kategori, di luar langkah umum (sunting `content` atau
 * generate ulang, lalu seed). `null` bila langkah umum sudah cukup.
 */
export function flashcardCategoryNote(
  category: ReportCategoryValue,
  key: string,
): FlashcardCategoryNote | null {
  switch (category) {
    case "READING_ERROR":
      // Validator seed memaksa furigana kata sama dengan `reading` note, dan
      // bacaan itu bagian dari key. Generate ulang hanya mengulang kesalahannya;
      // peninjau kata ragu yang dapat mengganti bacaan sambil mencatat override.
      return {
        text: "Bila bacaan kata itu sendiri yang keliru, generate ulang tidak menolong: bacaan itu bagian dari key, dan furigana kata wajib sama dengan field reading. Jangan ubah key atau reading secara manual. Isi ai.doubt dengan alasannya, tinjau, baca rencananya, lalu terapkan. Bila yang salah hanya furigana di contoh atau catatan, cukup sunting content.",
        commands: [
          `npm run fix:flashcard-doubts -- --key ${shellQuote(key)}`,
          "npm run fix:flashcard-doubts -- --apply",
        ],
      };
    case "TAG_ERROR":
      return {
        text: "Tag menentukan deck tempat kata ini muncul. Slug harus ada di src/flashcard-data/taxonomy.json, dan tag level tidak ditulis di content.tags.",
        commands: [],
      };
    default:
      return null;
  }
}
