import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LEVELS,
  bunpouContentProblems,
  comparisonProblems,
  contextSlidesBeforeBatch,
  discoverRawDecks,
  loadTaxonomy,
  normalizeBunpouContent,
  pointPublicationFlags,
  recomputePointOrders,
  toRomaji,
  validateCatalog,
} from "../../prisma/bunpou-data.mjs";
import { buildUserPrompt as buildExtractionUserPrompt } from "../../prisma/bunpou-extract-prompt.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function point(overrides = {}) {
  return {
    key: "teiru-aspek",
    order: 1,
    kind: "pattern",
    sectionKey: "sentence-patterns",
    family: null,
    title: "食べている",
    source: {
      slides: ["n5-bunpou/n5-bunpou-1.png"],
      title: "〜ている",
      meaning: "sedang",
      connection: "Vて + いる",
      formation: [],
      notes: "",
      examples: ["ご飯を食べています"],
    },
    extract: {
      model: "vision-model",
      promptVersion: "bunpou-extract-v2",
      extractedAt: "2026-10-01T00:00:00.000Z",
      doubt: null,
    },
    content: null,
    ai: null,
    ...overrides,
  };
}

function emptyPointFiles(): Map<string, { level: string; points: ReturnType<typeof point>[] }> {
  return new Map(LEVELS.map((level) => [level, { level, points: [] }]));
}

function validContent() {
  return {
    title: "{食|た}べている",
    senseLabel: null,
    meaningId: "sedang melakukan",
    meaningEn: "be doing",
    connections: [{ form: "v-te", pattern: "いる" }],
    formation: [],
    variants: [],
    explanation: ["Pola ini menyatakan tindakan yang sedang berlangsung."],
    examples: [
      { jp: "いまパンを__{食|た}べています__。", id: "Saya sedang makan roti.", en: "I am eating bread." },
      { jp: "{妹|いもうと}はテレビを__{見|み}ています__。", id: "Adik sedang menonton televisi.", en: "My sister is watching television." },
      { jp: "{父|ちち}は{新聞|しんぶん}を__{読|よ}んでいます__。", id: "Ayah sedang membaca koran.", en: "My father is reading a newspaper." },
    ],
    pitfalls: ["Bentuk て saja tidak menyatakan aspek progresif."],
    tags: ["aspect"],
  };
}

describe("penemuan source Bunpou", () => {
  it("mengurutkan nomor slide secara numerik dan mengabaikan dotfile", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bunpou-raw-"));
    temporaryDirectories.push(root);
    const deck = path.join(root, "n5-bunpou");
    await mkdir(deck);
    await Promise.all([
      writeFile(path.join(deck, "n5-bunpou-10.png"), ""),
      writeFile(path.join(deck, "n5-bunpou-2.png"), ""),
      writeFile(path.join(deck, "n5-bunpou-1.png"), ""),
      writeFile(path.join(deck, ".DS_Store"), ""),
    ]);

    const [found] = await discoverRawDecks(root);
    expect(found.files.map((file: { sequence: number }) => file.sequence)).toEqual([1, 2, 10]);
  });

  it("mengambil slide konteks tepat sebelum batch target", () => {
    const slides = Array.from({ length: 8 }, (_, index) => ({ path: `n3-bunpou/n3-bunpou-${index + 1}.png` }));
    expect(contextSlidesBeforeBatch(slides, slides.slice(6, 8), 5).map((slide) => slide.path)).toEqual(
      slides.slice(1, 6).map((slide) => slide.path),
    );
    expect(contextSlidesBeforeBatch(slides, slides.slice(0, 2), 5)).toEqual([]);
  });

  it("membedakan gambar konteks dan target dalam prompt ekstraksi", () => {
    const prompt = buildExtractionUserPrompt({
      level: "N3",
      deck: "n3-bunpou",
      contextSlides: [{ path: "n3-bunpou/n3-bunpou-2.png" }],
      slides: [{ path: "n3-bunpou/n3-bunpou-3.png" }],
      existingPoints: [],
    });
    expect(prompt).toContain("1. n3-bunpou/n3-bunpou-2.png");
    expect(prompt).toContain("2. n3-bunpou/n3-bunpou-3.png");
    expect(prompt).toContain("jangan keluarkan path ini");
    expect(prompt).toContain("wajib diekstrak");
  });
});

describe("kontrak content Bunpou", async () => {
  const taxonomy = await loadTaxonomy();

  it("menerima content lengkap yang siap ditampilkan", () => {
    expect(bunpouContentProblems(point(), validContent(), taxonomy)).toEqual([]);
  });

  it("menolak tanda baca Jepang pada prosa Indonesia", () => {
    const content = validContent();
    content.explanation[0] = "Pola ini menyatakan tindakan yang sedang berlangsung。";
    expect(bunpouContentProblems(point(), content, taxonomy).join(" ")).toContain("tanda baca Latin");
  });

  it("menormalkan tanda baca prosa tetapi mempertahankan kalimat Jepang murni", () => {
    const content = validContent();
    content.explanation[0] = "Pola ini menyatakan tindakan yang sedang berlangsung。";
    content.pitfalls = ["これは{日本語|にほんご}です。"];
    normalizeBunpouContent(content);
    expect(content.explanation[0]).toBe("Pola ini menyatakan tindakan yang sedang berlangsung.");
    expect(content.pitfalls[0]).toBe("これは{日本語|にほんご}です。");
  });

  it("menolak meaningId Inggris atau meaningEn Indonesia", () => {
    const content = validContent();
    content.meaningId = "action in progress";
    content.meaningEn = "tindakan yang sedang berlangsung";
    const problems = bunpouContentProblems(point(), content, taxonomy).join(" ");
    expect(problems).toContain("meaningId: tampak berbahasa Inggris");
    expect(problems).toContain("meaningEn: tampak berbahasa Indonesia");
  });

  it("menolak bahasa yang tercampur pada terjemahan contoh", () => {
    const content = validContent();
    content.examples[0]!.id = "I am eating bread.";
    content.examples[1]!.en = "Adik sedang penuh semangat.";
    const problems = bunpouContentProblems(point(), content, taxonomy).join(" ");
    expect(problems).toContain("examples[0].id: tampak berbahasa Inggris");
    expect(problems).toContain("examples[1].en: tampak berbahasa Indonesia");
  });

  it("menolak た atau だ di dalam target underline untuk sambungan v-ta saat strict", () => {
    const content = validContent();
    content.connections = [{ form: "v-ta", pattern: "たらどう" }];
    content.examples = [
      { jp: "お{茶|ちゃ}を{飲|の}ん__だらどう__？", id: "Bagaimana kalau minum teh?", en: "Why not drink tea?" },
      { jp: "{先生|せんせい}に{聞|き}い__たらどう__？", id: "Bagaimana kalau bertanya kepada guru?", en: "Why not ask the teacher?" },
      { jp: "ここに{書|か}い__たらどう__？", id: "Bagaimana kalau menulisnya di sini?", en: "Why not write it here?" },
    ];
    const problems = bunpouContentProblems(point(), content, taxonomy, {
      strictConnectionBoundary: true,
    }).join(" ");
    expect(problems).toContain("connections[0].pattern: た／だ adalah bagian form v-ta");
    expect(problems).toContain("examples[0].jp: た／だ bentuk v-ta harus berada di luar");
  });

  it("membedakan pending, doubt, dan siap terbit tanpa menghilangkan overlap", () => {
    expect(pointPublicationFlags(point({ extract: { ...point().extract, doubt: "teks buram" } }))).toEqual({
      pending: true,
      doubt: true,
      ready: false,
    });
    expect(pointPublicationFlags(point({ content: validContent(), ai: { doubt: null } }))).toEqual({
      pending: false,
      doubt: false,
      ready: true,
    });
  });
});

describe("urutan dan pencarian", () => {
  it("mengikuti posisi kemunculan pertama pada deck dan slide", () => {
    const files = emptyPointFiles();
    files.get("N5")!.points = [point({ key: "c", order: 1 }), point({ key: "a", order: 2 }), point({ key: "b", order: 3 })];
    recomputePointOrders(files, {
      decks: [{ key: "n5-bunpou", level: "N5", order: 1 }],
      slides: [
        { deck: "n5-bunpou", level: "N5", sequence: 2, points: ["c"] },
        { deck: "n5-bunpou", level: "N5", sequence: 1, points: ["b", "a"] },
      ],
    });
    expect(files.get("N5")!.points.map((item) => [item.key, item.order])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });

  it("mengubah kana, sokuon, dan katakana menjadi romaji pencarian", () => {
    expect(toRomaji("ガッコウ・で・べんきょうする")).toBe("gakkou de benkyousuru");
  });
});

describe("validasi family lintas level", async () => {
  const taxonomy = await loadTaxonomy();

  function familyPoint(level: "N5" | "N4", key: string, order: number) {
    const deck = `${level.toLowerCase()}-bunpou`;
    return point({
      key,
      order,
      family: "de",
      title: "〜で",
      source: {
        ...point().source,
        slides: [`${deck}/${deck}-1.png`],
      },
      content: { ...validContent(), title: "〜で", senseLabel: "tempat tindakan" },
      ai: { model: "text-model", promptVersion: "bunpou-content-v4", generatedAt: "2026-10-01T00:00:00.000Z", doubt: null },
    });
  }

  it("mengizinkan senseLabel yang sama pada level berbeda", () => {
    const files = emptyPointFiles();
    files.get("N5")!.points = [familyPoint("N5", "de-tempat-n5", 1)];
    files.get("N4")!.points = [familyPoint("N4", "de-tempat-n4", 1)];
    const manifest = {
      decks: [
        { key: "n5-bunpou", level: "N5", order: 1 },
        { key: "n4-bunpou", level: "N4", order: 1 },
      ],
      slides: [
        { path: "n5-bunpou/n5-bunpou-1.png", sha256: "n5", level: "N5", deck: "n5-bunpou", sequence: 1, points: ["de-tempat-n5"], skipped: null },
        { path: "n4-bunpou/n4-bunpou-1.png", sha256: "n4", level: "N4", deck: "n4-bunpou", sequence: 1, points: ["de-tempat-n4"], skipped: null },
      ],
    };

    expect(validateCatalog(files, manifest, taxonomy).errors.join(" ")).not.toContain("senseLabel");
  });

  it("tetap menolak senseLabel yang sama dalam satu level", () => {
    const files = emptyPointFiles();
    files.get("N4")!.points = [
      familyPoint("N4", "de-tempat-a", 1),
      familyPoint("N4", "de-tempat-b", 2),
    ];
    const manifest = {
      decks: [{ key: "n4-bunpou", level: "N4", order: 1 }],
      slides: [
        { path: "n4-bunpou/n4-bunpou-1.png", sha256: "n4", level: "N4", deck: "n4-bunpou", sequence: 1, points: ["de-tempat-a", "de-tempat-b"], skipped: null },
      ],
    };

    expect(validateCatalog(files, manifest, taxonomy).errors.join(" ")).toContain(
      'family "de": senseLabel "tempat tindakan" ganda di N4',
    );
  });
});

describe("kontrak comparison", () => {
  const points = new Map([
    ["a", { level: "N5", point: point({ key: "a" }) }],
    ["b", { level: "N5", point: point({ key: "b" }) }],
  ]);

  it("menolak urutan row yang berbeda dan option di luar anggota", () => {
    const problems = comparisonProblems(
      {
        key: "a-vs-b",
        title: "A dan B",
        points: ["a", "b"],
        content: {
          summary: "Keduanya berbeda fungsi.",
          rows: [
            { key: "b", nuance: "Nuansa A.", register: "Netral.", restriction: "Tidak ada." },
            { key: "a", nuance: "Nuansa B.", register: "Netral.", restriction: "Tidak ada." },
          ],
          contrasts: [
            {
              jp: "ここで[_]。",
              id: "Pilih bentuk yang sesuai.",
              options: [
                { key: "a", text: "a", verdict: "ok" },
                { key: "c", text: "c", verdict: "wrong" },
              ],
            },
          ],
        },
        ai: { doubt: null },
        reviewedAt: null,
      },
      points,
    ).join(" ");

    expect(problems).toContain("rows[0].key harus a");
    expect(problems).toContain("option c bukan anggota");
  });
});
