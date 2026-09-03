import { describe, expect, it } from "vitest";
import {
  FLASHCARD_NOTE_TYPES,
  FLASHCARD_NOTE_TYPE_KINDS,
  countCardsForNote,
  extractClozeOrdinals,
  getFieldIndex,
  getSortFieldIndex,
} from "./note-types";
import { renderCard, renderCloze } from "./lib/render/card-content";
import { fieldToPlainText, sanitizeFieldHtml } from "./lib/render/sanitize";

describe("definisi note type", () => {
  it("setiap note type non-cloze punya minimal satu template", () => {
    for (const kind of FLASHCARD_NOTE_TYPE_KINDS) {
      const definition = FLASHCARD_NOTE_TYPES[kind];
      if (definition.isCloze) continue;
      expect(definition.cardTemplates.length).toBeGreaterThan(0);
    }
  });

  it("template hanya merujuk field yang ada", () => {
    for (const kind of FLASHCARD_NOTE_TYPE_KINDS) {
      const definition = FLASHCARD_NOTE_TYPES[kind];
      const keys = new Set(definition.fields.map((field) => field.key));
      for (const template of definition.cardTemplates) {
        for (const key of [...template.front, ...template.back]) {
          expect(keys, `${kind}/${template.name}: ${key}`).toContain(key);
        }
      }
    }
  });

  it("ord template berurutan mulai dari nol", () => {
    for (const kind of FLASHCARD_NOTE_TYPE_KINDS) {
      const ords = FLASHCARD_NOTE_TYPES[kind].cardTemplates.map((item) => item.ord);
      expect(ords).toEqual(ords.map((_, index) => index));
    }
  });

  it("sort field jatuh ke field pertama bila tidak ditandai", () => {
    expect(getSortFieldIndex("VOCAB_JP")).toBe(getFieldIndex("VOCAB_JP", "word"));
    expect(getSortFieldIndex("KANA")).toBe(0);
  });
});

describe("jumlah kartu per note", () => {
  it("konstan untuk note type non-cloze", () => {
    expect(countCardsForNote("BASIC", ["a", "b"])).toBe(1);
    expect(countCardsForNote("BASIC_REVERSED", ["a", "b"])).toBe(2);
    expect(countCardsForNote("VOCAB_JP", ["食べる", "たべる", "makan", "", "", ""])).toBe(2);
    expect(countCardsForNote("KANA", ["あ", "a", ""])).toBe(2);
  });

  it("cloze menghasilkan satu kartu per nomor unik", () => {
    expect(countCardsForNote("CLOZE", ["{{c1::A}} dan {{c2::B}}", ""])).toBe(2);
    expect(countCardsForNote("CLOZE", ["{{c1::A}} lalu {{c1::C}}", ""])).toBe(1);
  });

  it("cloze tanpa penanda tidak menghasilkan kartu, sama seperti Anki", () => {
    expect(countCardsForNote("CLOZE", ["teks biasa", ""])).toBe(0);
  });

  it("nomor cloze diurutkan naik", () => {
    expect(extractClozeOrdinals("{{c3::x}} {{c1::y}} {{c2::z}}")).toEqual([1, 2, 3]);
  });
});

describe("sanitasi field", () => {
  it("membuang script beserta isinya diperlakukan sebagai teks", () => {
    const result = sanitizeFieldHtml('<script>alert("x")</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("</script>");
  });

  it("membuang atribut walau tag-nya diizinkan", () => {
    // `style` dan `onclick` adalah dua cara paling mudah merusak layout atau
    // menyuntik perilaku dari data import.
    const result = sanitizeFieldHtml('<b style="font-size:200px" onclick="x()">tebal</b>');
    expect(result).toBe("<b>tebal</b>");
  });

  it("mempertahankan markup inline yang aman", () => {
    expect(sanitizeFieldHtml("<b>a</b> <i>b</i><br>c")).toBe("<b>a</b> <i>b</i><br />c");
    expect(sanitizeFieldHtml("<ruby>漢<rt>かん</rt></ruby>")).toBe(
      "<ruby>漢<rt>かん</rt></ruby>",
    );
  });

  it("membuang tag yang tidak diizinkan tapi menyimpan teksnya", () => {
    expect(sanitizeFieldHtml('<div class="x">isi</div>')).toBe("isi");
  });

  it("meng-escape < yatim alih-alih menganggapnya tag", () => {
    expect(sanitizeFieldHtml("5 < 10")).toBe("5 &lt; 10");
  });

  it("membuang penanda [sound:] karena media belum didukung", () => {
    expect(sanitizeFieldHtml("食べる[sound:tabe.mp3]")).toBe("食べる");
  });

  it("teks polos membuang seluruh markup", () => {
    expect(fieldToPlainText("<b>食べる</b><br>[sound:a.mp3] &amp; lagi")).toBe(
      "食べる & lagi",
    );
  });
});

describe("render kartu", () => {
  const vocab = ["食べる", "たべる", "makan", "ご飯を食べる。", "Makan nasi.", ""];

  it("kartu pertama menanya kata, kartu kedua menanya arti", () => {
    const forward = renderCard("VOCAB_JP", vocab, 0);
    const reverse = renderCard("VOCAB_JP", vocab, 1);

    expect(forward.front.map((f) => f.key)).toEqual(["word"]);
    expect(reverse.front.map((f) => f.key)).toEqual(["meaning"]);
  });

  it("field kosong tidak ikut dirender", () => {
    const card = renderCard("VOCAB_JP", vocab, 0);
    expect(card.back.map((field) => field.key)).not.toContain("note");
  });

  it("menandai field Jepang supaya bisa diberi font besar", () => {
    const card = renderCard("VOCAB_JP", vocab, 0);
    expect(card.front[0]!.japanese).toBe(true);
  });

  it("cloze menyembunyikan nomor yang ditanya dan menampilkan sisanya", () => {
    const text = "日本語を{{c1::勉強}}して{{c2::います}}。";
    expect(renderCloze(text, 1, false)).toBe("日本語を[...]しています。");
    expect(renderCloze(text, 1, true)).toBe("日本語を<b>勉強</b>しています。");
  });

  it("cloze memakai hint bila disediakan", () => {
    expect(renderCloze("{{c1::勉強::kata benda}}する", 1, false)).toBe("[kata benda]する");
  });

  it("kartu cloze ke-n memakai nomor cloze ke-n", () => {
    const card = renderCard("CLOZE", ["{{c1::A}} dan {{c2::B}}", ""], 1);
    expect(card.templateName).toBe("Cloze 2");
    expect(card.front[0]!.html).toBe("A dan [...]");
  });
});
