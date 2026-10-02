import type { BunpouKind, BunpouPointSummary } from "../types";

export type BunpouCatalogFilters = {
  kind: BunpouKind | "";
  function: string;
  register: string;
  nuance: string;
  connection: string;
};

export const EMPTY_BUNPOU_FILTERS: BunpouCatalogFilters = {
  kind: "",
  function: "",
  register: "",
  nuance: "",
  connection: "",
};

/** Katakana → hiragana, supaya "ナガラ" tetap menemukan ながら. */
function toHiragana(value: string) {
  return value.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

/**
 * Kata kunci pencarian dengan normalisasi yang sama seperti `searchText` dari
 * seed (NFKC, huruf kecil), ditambah katakana diubah ke hiragana karena bacaan
 * di `searchText` ditulis hiragana.
 */
export function searchTerms(query: string): string[] {
  return toHiragana(query.normalize("NFKC").toLowerCase())
    .split(/\s+/)
    .filter(Boolean);
}

export function matchesBunpouQuery(point: BunpouPointSummary, terms: string[]) {
  const haystack = toHiragana(`${point.searchText} ${point.senseLabel ?? ""}`.toLowerCase());
  return terms.every((term) => haystack.includes(term));
}

export function matchesBunpouFilters(point: BunpouPointSummary, filters: BunpouCatalogFilters) {
  if (filters.kind && point.kind !== filters.kind) return false;
  for (const slug of [filters.function, filters.register, filters.nuance]) {
    if (slug && !point.tags.includes(slug)) return false;
  }
  if (filters.connection && !point.connectionForms.includes(filters.connection)) return false;
  return true;
}
