import { describe, expect, it } from "vitest";
import { compileDictionary } from "../../../../scripts/kana-race-dictionary";
import release from "@/kana-race-data/dictionary.v1.json";
import { DictionarySchema } from "../contracts";

describe("reviewable immutable dictionary", () => {
  it("reproduces the checked-in release from flashcard reading markup and separate curation", async () => {
    const result = await compileDictionary();
    expect(result.id).toBe(release.id); expect(result.dictionary).toEqual(DictionarySchema.parse(release));
    expect(result.dictionary.guesses.length).toBe(5623); expect(result.dictionary.answers.length).toBe(94);
    expect(Object.values(result.counts).every((count) => count.answers >= 10)).toBe(true);
    expect(result.dictionary.answers.some((answer) => answer.kana === "えーっと")).toBe(false);
    expect(result.words.get("おんなのひと")?.some((source) => source.word === "女の人")).toBe(true);
    expect(result.words.has("あるばいと")).toBe(true);
  });
});
