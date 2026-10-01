import { describe, expect, it } from "vitest";
import {
  englishHint,
  mergeVocabulary,
  parseAnkiReading,
  parseAnkiWord,
} from "../../../../prisma/flashcard-anki.mjs";
import {
  loadTaxonomy,
  toVocabRow,
  vocabContentProblems,
  vocabContentWarnings,
} from "../../../../prisma/flashcard-vocab.mjs";
import { parseReply, replyItemToContent } from "../../../../prisma/flashcard-vocab-prompt.mjs";
import { markupProblems } from "../../../../prisma/japanese-markup-check.mjs";

/**
 * Pipeline seed flashcard (prisma/*.mjs). Kasus Anki diambil dari data asli
 * deck sumber; kegagalan di sini berarti kata dengan bacaan rusak masuk ke
 * fixture atau kartu AI yang melanggar aturan lolos ke database.
 */

describe("bacaan dari furigana Anki", () => {
  it.each([
    ["考[かんが]えました", "考えました", "かんがえました"],
    ["〜 月[がつ]", "〜月", "〜がつ"],
    ["お 陰[かげ]", "お陰", "おかげ"],
    // Regex Anki menelan が ke dasar furigana kedua.
    ["口[くち]が軽[かる]い", "口が軽い", "くちがかるい"],
    // Furigana yang sudah mencakup kana di depan kanji tidak digandakan.
    ["お茶[おちゃ]", "お茶", "おちゃ"],
    ["よそ見[よそみ]", "よそ見", "よそみ"],
    ["ヶ月[かげつ]", "ヶ月", "かげつ"],
    ["あっという 間[あっというま]", "あっという間", "あっというま"],
    // 々 sesudah kurung berarti bacaannya diulang.
    ["中[なか]々", "中々", "なかなか"],
    // Penanda kelas kata di luar kurung tidak ikut bacaan.
    ["駄目[だめ]な", "駄目", "だめ"],
    ["不満[ふまん]", "不満な", "ふまんな"],
    // Nomor makna di furigana.
    ["悪[わる]い[2]", "悪い", "わるい"],
    ["JR[ジェイアール]", "JR", "ジェイアール"],
  ])("%s -> %s", (raw, word, reading) => {
    const parsed = parseAnkiReading(raw, word);
    expect(parsed.reading).toBe(reading);
    expect(parsed.uncertain).toBe(false);
  });

  it("memisahkan bacaan alternatif dan menandainya tidak pasti", () => {
    const parsed = parseAnkiReading("人気[じんき<br>にんき<br>ひとけ]", "人気");
    expect(parsed.reading).toBe("じんき");
    expect(parsed.alternatives).toEqual(["にんき", "ひとけ"]);
    expect(parsed.uncertain).toBe(true);
  });

  it("mengumpulkan anotasi dan tidak memasukkannya ke bacaan", () => {
    const parsed = parseAnkiReading("勉強[べんきょう]（する）", "勉強");
    expect(parsed.reading).toBe("べんきょう");
    expect(parsed.annotations).toEqual(["（する）"]);
  });

  it("bacaan yang hanya menutup sebagian kata ditandai tidak pasti", () => {
    expect(parseAnkiReading("（お 腹[なか]が）空[す]く", "お腹が空く").uncertain).toBe(true);
    expect(parseAnkiReading("少々", "少々").uncertain).toBe(true);
  });
});

describe("pesan markup untuk percobaan ulang", () => {
  it("menunjuk kurung kurawal bersarang", () => {
    expect(markupProblems("{お{腹|なか}|おなか}が{痛|いた}い")).toEqual([
      expect.stringContaining("kurung kurawal bersarang: {お{腹|なか}|おなか}"),
    ]);
  });

  it("menunjuk furigana yang kehilangan kurungnya", () => {
    expect(markupProblems("お{腹|なか}が__痛|いた__いです。")).toEqual([
      expect.stringContaining("tanda | di luar kurung kurawal: 痛|いた"),
      "kanji tanpa furigana: 痛",
    ]);
  });

  it("menerima __ yang membungkus blok furigana", () => {
    expect(markupProblems("__お{腹|なか}が{空|す}きました__。")).toEqual([]);
  });
});

describe("tulisan kata dari Anki", () => {
  it("membuang HTML, nomor makna, dan spasi", () => {
    expect(parseAnkiWord("<ruby><a>揶</a><a>揄</a><rt></rt></ruby>う").word).toBe("揶揄う");
    expect(parseAnkiWord("～が[1]").word).toBe("～が");
    expect(parseAnkiWord("話し 掛ける").word).toBe("話し掛ける");
  });

  it("menyimpan bacaan yang dikecualikan sebagai petunjuk", () => {
    expect(parseAnkiWord("何[×なに]")).toEqual({ word: "何", excludedReadings: ["なに"], annotations: [] });
  });

  it("melepas penanda kelas kata di ujung kata", () => {
    expect(parseAnkiWord("迷惑(する)")).toMatchObject({ word: "迷惑", annotations: ["(する)"] });
  });

  it("glos Inggris diambil dari bagian sebelum terjemahan Indonesia", () => {
    expect(englishHint("Start<br><br>Awal")).toBe("Start");
  });
});

type SourceItem = Parameters<typeof mergeVocabulary>[0][number];

const item = (overrides: Partial<SourceItem>): SourceItem => ({
  guid: "g",
  level: "N5",
  position: 1,
  word: "食事",
  reading: "しょくじ",
  alternatives: [],
  annotations: [],
  uncertain: false,
  excludedReadings: [],
  english: "meal",
  ...overrides,
});

describe("penggabungan daftar kata", () => {
  it("kata yang muncul di beberapa level masuk ke level termudah", () => {
    const [entry] = mergeVocabulary([
      item({ guid: "a", level: "N4", position: 5, english: "dining" }),
      item({ guid: "b", level: "N5", position: 9, english: "meal" }),
    ]);
    expect(entry).toMatchObject({
      key: "食事|しょくじ",
      level: "N5",
      position: 9,
      sourceLevels: ["N5", "N4"],
      sourceGuids: ["a", "b"],
    });
    expect(entry!.hints).toEqual(["dining", "meal"]);
  });

  it("bacaan sumber yang cacat menumpang ke bacaan bersih kata yang sama", () => {
    const entries = mergeVocabulary([
      item({ guid: "a", word: "別々", reading: "べつべつ" }),
      item({ guid: "b", word: "別々", reading: "べつ々", uncertain: true }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.readingUncertain).toBe(false);
  });

  it("homograf sungguhan tetap terpisah dan saling merujuk", () => {
    const entries = mergeVocabulary([
      item({ guid: "a", word: "今日", reading: "きょう" }),
      item({ guid: "b", word: "今日", reading: "こんにち", level: "N2" }),
    ]);
    expect(entries.map((entry) => entry.key).sort()).toEqual(["今日|きょう", "今日|こんにち"]);
    expect(entries.find((entry) => entry.reading === "きょう")!.homographs).toEqual(["こんにち"]);
  });
});

// ---------------------------------------------------------------------------

const note = {
  word: "食べる",
  reading: "たべる",
  readingUncertain: false,
  homographs: [] as string[],
};

const validContent = () => ({
  word: "{食|た}べる",
  meaningsId: ["makan", "menyantap"],
  meaningsEn: ["to eat"],
  examples: [
    {
      jp: "{毎朝|まいあさ}パンを__{食|た}べます__。",
      id: "Setiap pagi saya makan roti.",
      en: "I eat bread every morning.",
    },
  ],
  notes: "",
  tags: ["verb-ichidan", "food"],
});

describe("validasi isi kartu", async () => {
  const taxonomy = await loadTaxonomy();

  it("isi yang benar lolos", () => {
    expect(vocabContentProblems(note, validContent(), taxonomy)).toEqual([]);
  });

  it("menolak tulisan kata yang diubah", () => {
    const problems = vocabContentProblems(note, { ...validContent(), word: "{喰|た}べる" }, taxonomy);
    expect(problems.join(" ")).toContain("persis");
  });

  it("menolak bacaan yang berbeda dari sumber kecuali ditandai ragu", () => {
    const content = { ...validContent(), word: "{食|く}べる" };
    expect(vocabContentProblems(note, content, taxonomy).join(" ")).toContain("bacaan");
    expect(vocabContentProblems(note, content, taxonomy, { doubt: "sumber keliru" })).toEqual([]);
  });

  it("menolak kanji tanpa furigana di contoh kalimat", () => {
    const content = validContent();
    content.examples[0]!.jp = "毎朝パンを__{食|た}べます__。";
    expect(vocabContentProblems(note, content, taxonomy).join(" ")).toContain("kanji tanpa furigana");
  });

  it("mewajibkan kata target ditandai tepat satu kali", () => {
    const content = validContent();
    content.examples[0]!.jp = "{毎朝|まいあさ}パンを{食|た}べます。";
    expect(vocabContentProblems(note, content, taxonomy).join(" ")).toContain("__...__");
  });

  it("menolak arti kata kerja berbentuk 'untuk ...'", () => {
    const content = { ...validContent(), meaningsId: ["untuk makan"] };
    expect(vocabContentProblems(note, content, taxonomy).join(" ")).toContain("untuk");
  });

  it("menolak arti ganda, berpemisah titik koma, atau kosong", () => {
    const problems = vocabContentProblems(
      note,
      { ...validContent(), meaningsId: ["makan", "Makan", "a; b", " "] },
      taxonomy,
    ).join(" ");
    expect(problems).toContain("ganda");
    expect(problems).toContain("pisahkan tiap arti");
    expect(problems).toContain("kosong");
  });

  it("hanya menerima tag dari taxonomy dengan jumlah per dimensi yang benar", () => {
    const unknown = vocabContentProblems(note, { ...validContent(), tags: ["verb-ichidan", "makanan"] }, taxonomy);
    expect(unknown.join(" ")).toContain('"makanan" tidak ada');

    const level = vocabContentProblems(note, { ...validContent(), tags: ["verb-ichidan", "n5"] }, taxonomy);
    expect(level.join(" ")).toContain("diisi otomatis");

    const noPos = vocabContentProblems(note, { ...validContent(), tags: ["food"] }, taxonomy);
    expect(noPos.join(" ")).toContain("dimensi pos");
  });

  it("homograf yang tidak disebut di catatan hanya menjadi peringatan", () => {
    const homograph = { ...note, word: "今日", reading: "きょう", homographs: ["こんにち"] };
    const content = {
      ...validContent(),
      word: "{今日|きょう}",
      examples: [{ jp: "__{今日|きょう}__は{暑|あつ}い。", id: "Hari ini panas.", en: "It is hot today." }],
      tags: ["noun", "time"],
    };
    expect(vocabContentProblems(homograph, content, taxonomy)).toEqual([]);
    expect(vocabContentWarnings(homograph, content)).toHaveLength(1);
    expect(
      vocabContentWarnings(homograph, { ...content, notes: "Juga dibaca こんにち (dewasa ini)." }),
    ).toEqual([]);
    // Bacaan lain yang ditulis bermarkup juga terhitung disebut.
    expect(
      vocabContentWarnings(homograph, { ...content, notes: "Juga dibaca {今日|こんにち} (dewasa ini)." }),
    ).toEqual([]);
  });

  it("baris database menurunkan tulisan polos, bacaan, dan tag level", () => {
    const row = toVocabRow("N5", {
      key: "食べる|たべる",
      order: 3,
      content: validContent(),
      ai: { model: "m", promptVersion: "v", generatedAt: "2026-10-01T00:00:00.000Z", doubt: null },
    });
    expect(row).toMatchObject({
      wordPlain: "食べる",
      reading: "たべる",
      tags: ["n5", "verb-ichidan", "food"],
    });
  });
});

describe("jawaban model", () => {
  it("menoleransi blok kode dan memetakan per key", () => {
    const parsed = parseReply('```json\n{"notes":[{"key":"a"},{"key":"b"}]}\n```');
    expect("items" in parsed && [...parsed.items.keys()]).toEqual(["a", "b"]);
  });

  it("melaporkan JSON yang rusak", () => {
    expect(parseReply("maaf, tidak bisa")).toEqual({ error: "keluaran bukan JSON" });
  });

  it("merapikan item dan mengosongkan doubt yang hanya penanda", () => {
    const result = replyItemToContent({ key: "a", ...validContent(), tags: [" Food "], doubt: "-" });
    expect(result).toMatchObject({ doubt: null, content: { tags: ["food"] } });
  });

  it("melaporkan item yang bentuknya salah", () => {
    const result = replyItemToContent({ key: "a", word: "x" });
    expect(result.problems?.[0]).toContain("bentuk keluaran salah");
  });
});
