import { describe, expect, it } from "vitest";
import {
  buildCatalogIndex,
  lookupCandidates,
  linkFileProblems,
  nearestLevelKey,
  normalizeForm,
  questionLinkProblems,
} from "../../prisma/bunpou-links.mjs";
import { identifyProblems, selectProblems } from "../../prisma/bunpou-link-prompt.mjs";

type Seed = {
  key: string;
  title: string;
  family?: string | null;
  senseLabel?: string | null;
  variants?: string[];
  order?: number;
};

function point({ key, title, family = null, senseLabel = null, variants = [], order = 1 }: Seed) {
  return {
    key,
    order,
    kind: "pattern",
    sectionKey: "sentence-patterns",
    family,
    title,
    content: { title, senseLabel, meaningId: `arti ${key}`, variants },
  };
}

function catalog(levels: Record<string, Seed[]>) {
  const files = new Map<string, { points: ReturnType<typeof point>[] }>();
  for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
    files.set(level, { points: (levels[level] ?? []).map((seed, index) => point({ order: index + 1, ...seed })) });
  }
  return buildCatalogIndex(files);
}

const index = catalog({
  N5: [
    { key: "de-tempat", title: "〜で", family: "de", senseLabel: "tempat" },
    { key: "de-alat", title: "〜で", family: "de", senseLabel: "alat" },
  ],
  N4: [
    { key: "de-tempat-aktivitas", title: "〜で", family: "de", senseLabel: "tempat" },
    { key: "you-ni-suru", title: "〜ようにする" },
    { key: "te-shimau", title: "〜てしまう", variants: ["〜ちゃう"] },
  ],
  N3: [
    { key: "you-ni-tujuan", title: "〜ように", family: "you-ni", senseLabel: "tujuan" },
    { key: "ni-yotte", title: "〜に{依|よ}って" },
  ],
});

describe("normalizeForm", () => {
  it("drops markup, tildes, Latin placeholders, and katakana differences", () => {
    expect(normalizeForm("〜{依|よ}って")).toBe("依って");
    expect(normalizeForm("Vてしまう")).toBe("てしまう");
    expect(normalizeForm("〜ッポイ")).toBe("っぽい");
  });
});

describe("lookupCandidates", () => {
  it("matches across levels and expands to the whole family", () => {
    const keys = lookupCandidates(index, { form: "で", reading: "で" }, "N4");
    expect(keys).toEqual(["de-tempat-aktivitas", "de-tempat", "de-alat"]);
  });

  it("matches the furigana reading and variants", () => {
    expect(lookupCandidates(index, { form: "〜によって", reading: "によって" }, "N4")).toContain("ni-yotte");
    expect(lookupCandidates(index, { form: "〜ちゃう", reading: "ちゃう" }, "N4")).toEqual(["te-shimau"]);
  });

  it("adds partial matches after exact ones", () => {
    const keys = lookupCandidates(index, { form: "〜ように", reading: "ように" }, "N4");
    expect(keys[0]).toBe("you-ni-tujuan");
    expect(keys).toContain("you-ni-suru");
  });

  it("returns nothing for forms outside the catalog", () => {
    expect(lookupCandidates(index, { form: "〜わけがない", reading: "わけがない" }, "N4")).toEqual([]);
  });
});

describe("nearestLevelKey", () => {
  it("swaps to the same sense at the level nearest to the package", () => {
    expect(nearestLevelKey(index, "de-tempat", "N4")).toBe("de-tempat-aktivitas");
    expect(nearestLevelKey(index, "de-tempat-aktivitas", "N5")).toBe("de-tempat");
  });

  it("keeps a different sense", () => {
    expect(nearestLevelKey(index, "de-alat", "N4")).toBe("de-alat");
  });
});

const pattern = (role: "tested" | "distractor", key: string | null, candidates = key ? [key] : []) => ({
  form: "〜で",
  reading: "で",
  meaning: "tempat",
  role,
  candidates,
  key,
});

describe("questionLinkProblems", () => {
  it("rejects distractors for sentence composition and keys outside candidates", () => {
    const problems = questionLinkProblems(
      {
        mondaiType: "BUNPOU_SENTENCE_COMPOSITION",
        patterns: [pattern("tested", "de-alat", ["de-tempat"]), pattern("distractor", "de-tempat")],
        confidence: "high",
      },
      index,
    );
    expect(problems).toContain("soal 並べ替え tidak boleh punya distractor");
    expect(problems).toContain("patterns.0: key de-alat bukan salah satu candidates");
  });

  it("rejects one key in two roles and enforces confidence nullability", () => {
    expect(
      questionLinkProblems(
        {
          mondaiType: "BUNPOU_GRAMMAR",
          patterns: [pattern("tested", "de-tempat"), pattern("distractor", "de-tempat")],
          confidence: "high",
        },
        index,
      ),
    ).toContain("key dipakai sebagai tested dan distractor: de-tempat");
    expect(
      questionLinkProblems({ mondaiType: "BUNPOU_GRAMMAR", patterns: [pattern("tested", null)], confidence: "low" }, index),
    ).toContain("confidence harus null bila tidak ada key");
  });
});

describe("linkFileProblems", () => {
  const pkg = {
    name: "JLPT N4 - test",
    jlptLevel: "N4",
    questionContexts: [{ id: "ctx-dokkai-1", storyText: "…" }],
    testPackageItems: [
      {
        mondaiType: "BUNPOU_GRAMMAR",
        questions: [{ order: 1, questionText: "", questionChoices: [], questionAnswer: 1 }],
      },
      {
        mondaiType: "DOKKAI_SHORT_TEXT",
        questions: [{ order: 1, questionText: "", questionChoices: [], questionAnswer: 1, questionContextRef: "ctx-dokkai-1" }],
      },
    ],
  };
  const ai = { model: "m", promptVersion: "v", generatedAt: "2026-10-05T00:00:00.000Z" };

  it("accepts a valid file and flags unknown questions and contexts", () => {
    const record = { mondaiType: "BUNPOU_GRAMMAR", order: 1, patterns: [], confidence: null, note: null, ai };
    expect(linkFileProblems({ package: pkg.name, questions: [record], contexts: [] }, pkg, index)).toEqual([]);
    const problems = linkFileProblems(
      {
        package: pkg.name,
        questions: [record, { ...record, order: 2 }],
        contexts: [{ ref: "ctx-other", patterns: [], confidence: null, note: null, ai }],
      },
      pkg,
      index,
    );
    expect(problems).toContain("BUNPOU_GRAMMAR#2: soal tidak ada di fixture paket");
    expect(problems).toContain("ctx-other: bukan konteks soal dokkai di fixture");
  });
});

describe("stage validators", () => {
  it("requires hiragana readings and no distractors for sentence composition", () => {
    const entry = { item: { mondaiType: "BUNPOU_SENTENCE_COMPOSITION" } };
    const problems = identifyProblems(entry, {
      patterns: [{ form: "〜ように", reading: "ヨウニ", meaning: "agar", role: "distractor" }],
    });
    expect(problems).toContain("patterns.0: reading harus hiragana");
    expect(problems).toContain("soal 並べ替え tidak boleh punya distractor");
  });

  it("requires an answer for every selectable index, from its candidates", () => {
    const patterns = [pattern("tested", null, ["de-tempat", "de-alat"]), pattern("distractor", null, [])];
    expect(selectProblems(patterns, { choices: [], note: null })).toEqual(["index 0 belum dijawab"]);
    expect(selectProblems(patterns, { choices: [{ index: 0, key: "you-ni-suru" }], note: null })).toEqual([
      "index 0: you-ni-suru bukan salah satu candidates",
    ]);
    expect(selectProblems(patterns, { choices: [{ index: 0, key: null }, { index: 1, key: null }], note: null })).toEqual([
      "index 1 tidak dikirim",
    ]);
  });
});

describe("lookup normalization", () => {
  const politeIndex = catalog({
    N5: [
      { key: "ni-ikimasu", title: "〜に{行|い}きます／{来|き}ます" },
      { key: "ya-daftar", title: "〜や" },
      { key: "ga-hoshii", title: "〜がほしいです" },
    ],
  });

  it("matches dictionary-form queries against polite catalog titles", () => {
    expect(lookupCandidates(politeIndex, { form: "〜に行く", reading: "にいく" }, "N5")).toEqual(["ni-ikimasu"]);
    expect(lookupCandidates(politeIndex, { form: "〜がほしい", reading: "がほしい" }, "N5")).toEqual(["ga-hoshii"]);
  });

  it("looks up each segment of a compound pattern", () => {
    expect(lookupCandidates(politeIndex, { form: "〜や〜など", reading: "やなど" }, "N5")).toEqual(["ya-daftar"]);
  });
});

describe("catalog search forms", () => {
  it("indexes titles without parenthesized parts", () => {
    const shiIndex = catalog({ N4: [{ key: "shi-paralel", title: "〜し（〜し）" }] });
    expect(lookupCandidates(shiIndex, { form: "〜し", reading: "し" }, "N4")).toEqual(["shi-paralel"]);
  });
});

describe("leading particle fallback", () => {
  const particleIndex = catalog({
    N5: [{ key: "ni-kara-morau", title: "〜に", family: "ni", senseLabel: "sumber" }, { key: "ni-tempat", title: "〜に", family: "ni", senseLabel: "tempat" }],
    N4: [{ key: "wo-morau", title: "〜をもらう" }],
  });

  it("splits a particle glued to a verb when the whole form has no candidates", () => {
    const keys = lookupCandidates(particleIndex, { form: "〜にもらう", reading: "にもらう" }, "N5");
    expect(keys).toEqual(["ni-kara-morau", "ni-tempat", "wo-morau"]);
  });
});

describe("conjugation titles", () => {
  it("indexes 〜形 titles by their ending", () => {
    const base = point({ key: "ta-kei", title: "た形" });
    const conjugation = { ...base, kind: "conjugation", content: { ...base.content, formation: [] } };
    expect(lookupCandidates(buildCatalogIndex(new Map([["N5", { points: [conjugation] }]])), { form: "〜た", reading: "た" }, "N5")).toEqual(["ta-kei"]);
  });
});
