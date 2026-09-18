import { describe, expect, it } from "vitest";
import {
  extractPartialJapanese,
  normalizeFurigana,
  parseLabelledReply,
  stripCodeFence,
} from "./parse-reply";

describe("parseLabelledReply", () => {
  it("mengurai tiga baris berlabel", () => {
    expect(parseLabelledReply("JA: やっほ！\nID: Hai!\nRO: Yahho!")).toEqual({
      contentJa: "やっほ！",
      contentTranslation: "Hai!",
      contentRomaji: "Yahho!",
    });
  });

  it("mempertahankan markup furigana", () => {
    const parsed = parseLabelledReply("JA: {元気|げんき}？\nID: Apa kabar?\nRO: Genki?");
    expect(parsed?.contentJa).toBe("{元気|げんき}？");
  });

  it("mengizinkan label huruf kecil dan spasi berlebih", () => {
    const parsed = parseLabelledReply("  ja :  こんにちは \n id : Halo ");
    expect(parsed?.contentJa).toBe("こんにちは");
    expect(parsed?.contentTranslation).toBe("Halo");
  });

  it("menerima balasan tanpa label sebagai bahasa Jepang", () => {
    expect(parseLabelledReply("こんにちは")).toEqual({
      contentJa: "こんにちは",
      contentTranslation: null,
      contentRomaji: null,
    });
  });

  it("mengembalikan null untuk balasan kosong", () => {
    expect(parseLabelledReply("   ")).toBeNull();
  });

  it("membiarkan terjemahan dan romaji kosong bila tidak diberikan", () => {
    expect(parseLabelledReply("JA: はい")).toEqual({
      contentJa: "はい",
      contentTranslation: null,
      contentRomaji: null,
    });
  });

  it("tidak memotong isi yang tertulis lebih dari satu baris", () => {
    const parsed = parseLabelledReply("JA: いち\nに\nID: satu dua");
    expect(parsed?.contentJa).toBe("いち\nに");
    expect(parsed?.contentTranslation).toBe("satu dua");
  });
});

describe("stripCodeFence", () => {
  it("membuang pagar kode json", () => {
    expect(stripCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("membiarkan teks tanpa pagar", () => {
    expect(stripCodeFence('{"a":1}')).toBe('{"a":1}');
  });
});

describe("normalizeFurigana", () => {
  it("memperbaiki bacaan yang ditulis setelah kanji", () => {
    expect(normalizeFurigana("何{なに}？")).toBe("{何|なに}？");
    expect(normalizeFurigana("学校{がっこう}に行{い}く")).toBe("{学校|がっこう}に{行|い}く");
  });

  it("tidak mengubah markup yang sudah benar", () => {
    const benar = "{学校|がっこう}は{楽|たの}しいです";
    expect(normalizeFurigana(benar)).toBe(benar);
  });

  it("tidak menyentuh teks tanpa kanji", () => {
    expect(normalizeFurigana("やっほ！げんき？")).toBe("やっほ！げんき？");
  });

  it("diterapkan saat mengurai balasan", () => {
    expect(parseLabelledReply("JA: 何{なに}？")?.contentJa).toBe("{何|なに}？");
  });
});

describe("ketahanan pengurai terhadap keluaran yang menyimpang", () => {
  it("menerima label bergaya markdown tebal", () => {
    const parsed = parseLabelledReply("**JA:** こんにちは\n**ID:** Halo");
    expect(parsed?.contentJa).toBe("こんにちは");
    expect(parsed?.contentTranslation).toBe("Halo");
  });

  it("menerima label yang diawali tanda daftar", () => {
    expect(parseLabelledReply("- JA: はい\n- ID: Ya")?.contentJa).toBe("はい");
  });

  it("menerima titik dua lebar Jepang", () => {
    expect(parseLabelledReply("JA： そうですね")?.contentJa).toBe("そうですね");
  });

  it("membuang pagar kode", () => {
    expect(parseLabelledReply("```\nJA: どうも\n```")?.contentJa).toBe("どうも");
  });

  it("mengambil baris Jepang bila label JA hilang", () => {
    const parsed = parseLabelledReply("Berikut balasannya:\nこんばんは\nID: Selamat malam");
    expect(parsed?.contentJa).toBe("こんばんは");
    expect(parsed?.contentTranslation).toBe("Selamat malam");
  });

  it("menolak balasan yang tidak mengandung aksara Jepang sama sekali", () => {
    expect(parseLabelledReply("Sorry, I cannot help with that.")).toBeNull();
  });
});

describe("extractPartialJapanese", () => {
  it("kosong sebelum ada isi apa pun", () => {
    expect(extractPartialJapanese("")).toBe("");
    expect(extractPartialJapanese("JA")).toBe("");
  });

  it("menampilkan isi yang sedang mengalir", () => {
    expect(extractPartialJapanese("JA: 学校")).toBe("学校");
    expect(extractPartialJapanese("JA: {学校|がっこう}は")).toBe("{学校|がっこう}は");
  });

  it("berhenti ketika label berikutnya muncul", () => {
    expect(extractPartialJapanese("JA: こんにちは\nID: Halo")).toBe("こんにちは");
  });

  it("menormalkan furigana yang salah bentuk saat mengalir", () => {
    expect(extractPartialJapanese("JA: 何{なに}")).toBe("{何|なに}");
  });

  it("menampilkan teks Jepang meski label belum muncul", () => {
    expect(extractPartialJapanese("こんばんは")).toBe("こんばんは");
  });
});
