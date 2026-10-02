import type { ReportCategoryValue } from "../constants";
import { shellQuote } from "./flashcard-target";

// Katalog bunpou sebagai target laporan. Sama seperti kartu flashcard, isinya
// TIDAK diedit dari admin: katalog diisi `seed:bunpou` dari src/bunpou-data/,
// jadi perbaikannya dilakukan di fixture. `key` adalah satu-satunya penghubung
// baris katalog dengan entri fixture-nya.
//
// Sengaja tanpa "server-only" dan tanpa impor `@/constants`: layar admin dan
// action laporan sama-sama memakainya, dan isinya fungsi murni yang diuji unit.

/** Snapshot `Report.targetLabel`, mis. "Bunpou · N5 · de-tempat". */
export function bunpouPointReportLabel({ key, level }: { key: string; level: string }) {
  return `Bunpou · ${level} · ${key}`;
}

/** Snapshot `Report.targetLabel`, mis. "Bunpou · perbandingan · alasan-kara-node". */
export function bunpouComparisonReportLabel({ key }: { key: string }) {
  return `Bunpou · perbandingan · ${key}`;
}

export function bunpouPointFixtureFile(level: string) {
  return `src/bunpou-data/points/${level.toLowerCase()}.json`;
}

export const BUNPOU_COMPARISON_FIXTURE_FILE = "src/bunpou-data/comparisons.json";

export function bunpouPointRegenerateCommand(key: string) {
  return `npm run gen:bunpou -- --key ${shellQuote(key)} --overwrite`;
}

export function bunpouComparisonRegenerateCommand(key: string) {
  return `npm run gen:bunpou-comparisons -- --key ${shellQuote(key)} --overwrite`;
}

export const BUNPOU_SEED_COMMANDS = ["npm run seed:bunpou:check", "npm run seed:bunpou"] as const;

/**
 * Catatan tambahan per kategori laporan pola, di luar langkah umum. `null` bila
 * langkah umum (sunting `content` atau generate ulang, lalu seed) sudah cukup.
 */
export function bunpouPointCategoryNote(category: ReportCategoryValue): string | null {
  switch (category) {
    case "CONNECTION_ERROR":
      return "Sambungan memakai slug bentuk baku dari connectionForms di src/bunpou-data/taxonomy.json; bentuk yang tidak ada di sana wajib ditulis sebagai \"other\" dengan note. Bila sambungan di slide sumber yang keliru, isi ai.doubt supaya generate ulang tidak mengulanginya.";
    case "READING_ERROR":
      return "Furigana diperiksa prisma/japanese-markup-check.mjs saat seed, tetapi bacaan yang salah tetap lolos. Sunting markup {kanji|bacaan} di content secara langsung.";
    default:
      return null;
  }
}
