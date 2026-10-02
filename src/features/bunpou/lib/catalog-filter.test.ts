import { describe, expect, it } from "vitest";
import type { BunpouPointSummary } from "../types";
import {
  EMPTY_BUNPOU_FILTERS,
  matchesBunpouFilters,
  matchesBunpouQuery,
  searchTerms,
} from "./catalog-filter";

const nagara: BunpouPointSummary = {
  key: "nagara-sambil",
  level: "N4",
  order: 12,
  kind: "PATTERN",
  sectionKey: "sentence-patterns",
  family: "nagara",
  senseLabel: "sambil",
  title: "〜ながら",
  titlePlain: "〜ながら",
  titleReading: "ながら",
  titleRomaji: "nagara",
  meaningId: "Sambil melakukan …",
  meaningEn: "While doing …",
  searchText: "〜ながら ながら nagara sambil melakukan … while doing …",
  tags: ["simultaneous", "casual"],
  connectionForms: ["v-masu"],
};

describe("searchTerms", () => {
  it("normalizes width, case, and katakana", () => {
    expect(searchTerms("  ＮＡＧＡＲＡ  ナガラ ")).toEqual(["nagara", "ながら"]);
  });

  it("returns no terms for blank input", () => {
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("matchesBunpouQuery", () => {
  it("requires every term to match", () => {
    expect(matchesBunpouQuery(nagara, searchTerms("nagara sambil"))).toBe(true);
    expect(matchesBunpouQuery(nagara, searchTerms("nagara meskipun"))).toBe(false);
  });

  it("matches katakana input against hiragana readings", () => {
    expect(matchesBunpouQuery(nagara, searchTerms("ナガラ"))).toBe(true);
  });
});

describe("matchesBunpouFilters", () => {
  it("passes with no filters", () => {
    expect(matchesBunpouFilters(nagara, EMPTY_BUNPOU_FILTERS)).toBe(true);
  });

  it("checks kind, tags, and connection forms together", () => {
    expect(
      matchesBunpouFilters(nagara, {
        ...EMPTY_BUNPOU_FILTERS,
        kind: "PATTERN",
        function: "simultaneous",
        register: "casual",
        connection: "v-masu",
      }),
    ).toBe(true);
    expect(matchesBunpouFilters(nagara, { ...EMPTY_BUNPOU_FILTERS, kind: "PARTICLE" })).toBe(false);
    expect(matchesBunpouFilters(nagara, { ...EMPTY_BUNPOU_FILTERS, nuance: "negative" })).toBe(false);
    expect(matchesBunpouFilters(nagara, { ...EMPTY_BUNPOU_FILTERS, connection: "v-te" })).toBe(false);
  });
});
