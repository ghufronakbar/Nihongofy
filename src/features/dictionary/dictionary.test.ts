import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { DICTIONARY_LIMITS } from "@/constants/dictionary";
import { dictionaryCandidates } from "./deinflect";
import { dictionaryQuerySchema, type DictionaryRecord } from "./schemas";
import { lookupDictionary, type DictionaryReader } from "./lookup";
import { dictionaryManifest, dictionaryReader, dictionaryReaderMetrics } from "./reader";

describe("JMdict full-English index", () => {
  it("uses the complete, checksummed release with bounded lazy reads", () => {
    expect(dictionaryManifest.commonOnly).toBe(false);
    expect(dictionaryManifest.entryCount).toBe(218898);
    expect(Object.keys(dictionaryManifest.files)).toHaveLength(512);
  });

  it.each([
    ["勉強", "勉強"], ["ありがとう", "ありがとう"], ["食べました", "食べる"],
    ["行かなかった", "行く"], ["していました", "する"], ["来なかった", "来る"],
    ["高くなかった", "高い"], ["書いた", "書く"], ["泳いで", "泳ぐ"],
    ["飲みませんでした", "飲む"], ["待って", "待つ"], ["遊ばない", "遊ぶ"],
    ["話させられました", "話す"], ["食べさせました", "食べる"], ["読まれました", "読む"],
    ["書けました", "書く"], ["来られた", "来る"], ["きました", "来る"],
    ["勉強しました", "勉強"], ["こんぴゅーたー", "コンピューター"],
  ])("%s includes the POS-validated lemma %s", async (surface, lemma) => {
    const result = await lookupDictionary(surface, dictionaryReader());
    expect(result.hits.map((hit) => hit.word)).toContain(lemma);
    expect(result.hits.length).toBeLessThanOrEqual(10);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(DICTIONARY_LIMITS.responseBytes);
  });

  it("retains multiple readings and filters sense restrictions in real data", async () => {
    const result = await lookupDictionary("明日", dictionaryReader());
    expect(result.hits.map((hit) => hit.reading)).toEqual(expect.arrayContaining(["あした", "あす", "みょうにち"]));
    const future = (reading: string) => result.hits.find((hit) => hit.reading === reading)?.senses.flatMap((sense) => sense.glosses).includes("near future");
    expect(future("あす")).toBe(true);
    expect(future("あした")).toBe(false);
    expect(future("みょうにち")).toBe(false);
  });

  it("returns exact homographs before less direct alternatives, and empty hits distinctly", async () => {
    const result = await lookupDictionary("生", dictionaryReader());
    expect(new Set(result.hits.map((hit) => hit.reading)).size).toBeGreaterThan(2);
    expect(result.hits[0].match).toBe("exact");
    expect((await lookupDictionary("謎謎謎ほげほげ不存在", dictionaryReader())).hits).toEqual([]);
    expect(dictionaryReaderMetrics().cacheBytes).toBeLessThanOrEqual(DICTIONARY_LIMITS.shardCacheBytes);
  });

  it("does not turn nouns into conjugated verbs just because a suffix matches", async () => {
    expect((await lookupDictionary("猫ました", dictionaryReader())).hits).toEqual([]);
    expect(dictionaryCandidates("食べさせられませんでした").length).toBeLessThanOrEqual(DICTIONARY_LIMITS.candidates);
  });
});

describe("input and lexical restrictions", () => {
  it("normalizes width and Unicode without removing punctuation or suffixes", () => {
    expect(dictionaryQuerySchema.parse("  ｶﾞｯｺｳ  ")).toBe("ガッコウ");
    expect(dictionaryQuerySchema.parse("食べました")).toBe("食べました");
    for (const invalid of ["", "hello", "あ".repeat(41), "食\n物", "食\u200b物"]) {
      expect(dictionaryQuerySchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("never attaches a restricted reading/sense to the wrong writing", async () => {
    const record: DictionaryRecord = {
      id: "1", kanji: [{ text: "甲", common: true, tags: [] }, { text: "乙", common: false, tags: [] }],
      kana: [{ text: "こう", common: true, tags: [], appliesToKanji: ["甲"] },
        { text: "おつ", common: false, tags: [], appliesToKanji: ["乙"] },
        { text: "かな", common: false, tags: [], appliesToKanji: [] }],
      sense: [
        { partOfSpeech: ["n"], appliesToKanji: ["甲"], appliesToKana: ["こう"], gloss: ["first"], field: [], dialect: [], misc: [], info: [] },
        { partOfSpeech: ["n"], appliesToKanji: ["乙"], appliesToKana: ["おつ"], gloss: ["second"], field: [], dialect: [], misc: ["arch"], info: [] },
        { partOfSpeech: ["n"], appliesToKanji: ["*"], appliesToKana: ["かな"], gloss: ["kana only"], field: [], dialect: [], misc: [], info: [] },
      ],
    };
    const reader: DictionaryReader = { version: "fixture", sourceDate: "2026-10-12", tags: { arch: "archaic" },
      findTerms: async (terms) => new Map(terms.filter((term) => ["甲", "乙", "かな"].includes(term)).map((term) => [term, ["1"]])),
      readEntries: async () => [record] };
    const first = await lookupDictionary("甲", reader);
    expect(first.hits).toHaveLength(1);
    expect(first.hits[0].reading).toBe("こう");
    expect(first.hits[0].senses[0].glosses).toEqual(["first"]);
    const kana = await lookupDictionary("かな", reader);
    expect(kana.hits[0].word).toBe("かな");
    expect(kana.hits[0].senses[0].glosses).toEqual(["kana only"]);
    const second = await lookupDictionary("乙", reader);
    expect(second.hits[0].senses[0].labels).toEqual(["archaic"]);
  });
});
