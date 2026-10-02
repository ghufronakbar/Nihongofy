import type { BunpouKind as PrismaBunpouKind, JlptLevel } from "@prisma/client";

export type BunpouLevel = JlptLevel;
export type BunpouKind = PrismaBunpouKind;

/**
 * Satu pola di katalog `/bunpou`. Dikirim utuh ke client untuk pencarian dan
 * filter, jadi hanya memuat kolom ringkas — isi lengkap ada di
 * `BunpouPointDetail`.
 */
export type BunpouPointSummary = {
  key: string;
  level: BunpouLevel;
  order: number;
  kind: BunpouKind;
  sectionKey: string;
  family: string | null;
  senseLabel: string | null;
  /** Markup furigana. */
  title: string;
  titlePlain: string;
  titleReading: string;
  titleRomaji: string;
  meaningId: string;
  meaningEn: string;
  /** Huruf kecil, NFKC; disusun seed dari judul, bacaan, romaji, arti, dan variasi. */
  searchText: string;
  tags: string[];
  connectionForms: string[];
};

export type BunpouConnection = { form: string; pattern: string; note?: string | null };

export type BunpouFormationRow = {
  label: string;
  input: string;
  rule: string;
  output: string;
  note: string | null;
};

export type BunpouExample = { jp: string; id: string; en: string };

export type BunpouContent = {
  title: string;
  senseLabel: string | null;
  meaningId: string;
  meaningEn: string;
  connections: BunpouConnection[];
  formation: BunpouFormationRow[];
  variants: string[];
  explanation: string[];
  examples: BunpouExample[];
  pitfalls: string[];
  tags: string[];
};

export type BunpouComparisonLink = { key: string; title: string; summary: string };

export type BunpouPointDetail = {
  point: BunpouPointSummary;
  content: BunpouContent;
  updatedAt: Date;
  /** Makna lain dari bentuk yang sama, termasuk pola ini sendiri, urut level lalu `order`. */
  family: BunpouPointSummary[];
  comparisons: BunpouComparisonLink[];
  /** Pola lain dengan fungsi yang sama, di luar family. */
  related: BunpouPointSummary[];
  previous: BunpouPointSummary | null;
  next: BunpouPointSummary | null;
};

export type BunpouVerdict = "ok" | "awkward" | "wrong";

export type BunpouComparisonContent = {
  summary: string;
  rows: { key: string; nuance: string; register: string; restriction: string }[];
  contrasts: {
    jp: string;
    id: string;
    options: { key: string; text: string; verdict: BunpouVerdict; note?: string | null }[];
  }[];
};

export type BunpouComparisonDetail = {
  key: string;
  title: string;
  content: BunpouComparisonContent;
  updatedAt: Date;
  /** Urut kolom tabel. */
  points: BunpouPointSummary[];
};
