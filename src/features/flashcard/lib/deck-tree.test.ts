import { describe, expect, it } from "vitest";
import {
  buildDeckTree,
  collectSubtreeDeckIds,
  deckAncestorNames,
  deckLabel,
  deckParentName,
  flattenDeckTree,
  isDeckDescendantOf,
  isDeckInSubtree,
  rollUpDeckTree,
} from "./deck-tree";

const decks = [
  { id: 1, name: "Core" },
  { id: 2, name: "Core::N3" },
  { id: 3, name: "Core::N3::Verbs" },
  { id: 4, name: "Core::N2" },
  { id: 5, name: "Core2" },
  { id: 6, name: "Kanji" },
];

describe("nama deck hierarkis", () => {
  it("mengambil segmen terakhir sebagai label", () => {
    expect(deckLabel("Core::N3::Verbs")).toBe("Verbs");
    expect(deckLabel("Kanji")).toBe("Kanji");
  });

  it("menentukan induk langsung", () => {
    expect(deckParentName("Core::N3::Verbs")).toBe("Core::N3");
    expect(deckParentName("Core")).toBeNull();
  });

  it("mendaftar seluruh leluhur dari terluar", () => {
    expect(deckAncestorNames("Core::N3::Verbs")).toEqual(["Core", "Core::N3"]);
  });

  it("tidak menganggap Core2 sebagai anak dari Core", () => {
    // Prefix mentah akan salah di sini; pembandingnya harus memakai pemisah penuh.
    expect(isDeckDescendantOf("Core2", "Core")).toBe(false);
    expect(isDeckDescendantOf("Core::N3", "Core")).toBe(true);
  });

  it("subtree mencakup deck itu sendiri", () => {
    expect(isDeckInSubtree("Core", "Core")).toBe(true);
    expect(isDeckInSubtree("Core2", "Core")).toBe(false);
  });

  it("mengumpulkan id seluruh subtree", () => {
    expect(collectSubtreeDeckIds(decks, "Core").sort()).toEqual([1, 2, 3, 4]);
    expect(collectSubtreeDeckIds(decks, "Core::N3").sort()).toEqual([2, 3]);
  });
});

describe("pohon deck", () => {
  it("menyusun anak di bawah induknya", () => {
    const roots = buildDeckTree(decks);

    expect(roots.map((node) => node.deck.name)).toEqual(["Core", "Core2", "Kanji"]);
    const core = roots[0]!;
    expect(core.children.map((node) => node.label)).toEqual(["N2", "N3"]);
    expect(core.children[1]!.children.map((node) => node.label)).toEqual(["Verbs"]);
  });

  it("memperlakukan deck yatim sebagai root supaya tidak hilang dari UI", () => {
    const roots = buildDeckTree([{ id: 1, name: "Hilang::Anak" }]);

    expect(roots).toHaveLength(1);
    expect(roots[0]!.deck.name).toBe("Hilang::Anak");
    expect(roots[0]!.depth).toBe(0);
  });

  it("meratakan pohon sesuai urutan tampil", () => {
    expect(flattenDeckTree(buildDeckTree(decks)).map((node) => node.deck.name)).toEqual([
      "Core",
      "Core::N2",
      "Core::N3",
      "Core::N3::Verbs",
      "Core2",
      "Kanji",
    ]);
  });

  it("menjumlahkan nilai node beserta keturunannya", () => {
    const counts = new Map([
      [1, 1],
      [2, 10],
      [3, 100],
      [4, 1_000],
    ]);
    const core = buildDeckTree(decks)[0]!;

    expect(rollUpDeckTree(core, (deck) => counts.get(deck.id) ?? 0)).toBe(1_111);
  });
});
