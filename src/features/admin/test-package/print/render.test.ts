import { describe, expect, it } from "vitest";
import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";
import { blankMarkerNumbers, labelQuestions, replaceBlankMarkers } from "./numbering";
import { PrintTestPackageQuerySchema } from "../schemas";
import { renderAnswerKey, renderPrintableTestPackage } from "./render";
import type { AnswerKeyPackage, PrintContext, PrintItem, PrintPackage, PrintQuestion } from "./types";

let nextId = 1;

function question(overrides: Partial<PrintQuestion> & { choices?: string[] } = {}): PrintQuestion {
  const { choices = ["", "", "", ""], ...rest } = overrides;
  return {
    id: nextId++,
    order: 1,
    questionText: "",
    questionImage: null,
    questionContext: null,
    questionChoices: choices.map((answerText, index) => ({
      codeAnswer: index + 1,
      answerText,
      answerImage: null,
    })),
    ...rest,
  };
}

function item(
  mondaiType: MondaiType,
  section: JlptSection,
  questions: PrintQuestion[],
  overrides: Partial<PrintItem> = {},
): PrintItem {
  return {
    id: nextId++,
    session: 1,
    order: 1,
    section,
    mondaiType,
    instruction: null,
    questions: questions.map((entry, index) => ({ ...entry, order: index + 1 })),
    ...overrides,
  };
}

function context(storyText: string | null, storyImage: string | null = null): PrintContext {
  return { id: nextId++, storyText, storyImage };
}

function pkg(items: PrintItem[], jlptLevel: JlptLevel = "N5"): PrintPackage {
  return { name: "JLPT N5 - 2024年07月", jlptLevel, testPackageItems: items };
}

const render = (value: PrintPackage, branded = false) =>
  renderPrintableTestPackage(value, {
    branding: branded ? { name: "Nihongofy", host: "jlpt.lans.my.id" } : null,
  });

// Kunci jawaban dari fixture lembar soal; `answers` per id soal, default 1.
const renderKey = (value: PrintPackage, answers: Record<number, number> = {}, branded = false) => {
  const answerKey: AnswerKeyPackage = {
    name: value.name,
    jlptLevel: value.jlptLevel,
    testPackageItems: value.testPackageItems.map((entry) => ({
      id: entry.id,
      session: entry.session,
      order: entry.order,
      section: entry.section,
      mondaiType: entry.mondaiType,
      questions: entry.questions.map((entry) => ({
        id: entry.id,
        order: entry.order,
        questionText: entry.questionText,
        questionAnswer: answers[entry.id] ?? 1,
      })),
    })),
  };
  return renderAnswerKey(answerKey, {
    branding: branded ? { name: "Nihongofy", host: "jlpt.lans.my.id" } : null,
  });
};

// Isi <body> saja, tanpa CSS di <head>.
const bodyOf = (html: string) => html.slice(html.indexOf("<body>"));

describe("lembar soal 聴解 — hanya yang tercetak di kertas asli", () => {
  it("tidak mencetak pertanyaan 課題理解/ポイント理解, tetapi mencetak teks pilihannya", () => {
    const html = render(
      pkg([
        item("CHOUKAI_TASK_BASED", "CHOUKAI", [
          question({ questionText: "男の学生はいつ宿題を出しますか。", choices: ["かようび", "すいようび", "もくようび", "きんようび"] }),
        ]),
        item(
          "CHOUKAI_MAIN_POINT",
          "CHOUKAI",
          [question({ questionText: "二人はどこで昼ご飯を食べますか。", choices: ["しょくどう", "ラーメンや", "うどんや", "カレーや"] })],
          { order: 2 },
        ),
      ]),
    );
    expect(html).not.toContain("宿題");
    expect(html).not.toContain("昼ご飯");
    expect(html).toContain("すいようび");
    expect(html).toContain("ラーメンや");
  });

  it("tidak mencetak teks 概要理解 dan 即時応答 walau datanya berisi transkrip", () => {
    const html = render(
      pkg(
        [
          item("CHOUKAI_OUTLINE", "CHOUKAI", [
            question({ questionText: "男の人は何について話していますか。", choices: ["町内会の役員", "祭り", "交流", "取り組み"] }),
          ]),
          item(
            "CHOUKAI_QUICK_RESPONSE",
            "CHOUKAI",
            [question({ questionText: "料理の腕が上がったんじゃない？", choices: ["わかる？", "全然上達してない？", "どうしたら", ""] })],
            { order: 2 },
          ),
        ],
        "N1",
      ),
    );
    for (const leaked of ["話していますか", "町内会", "料理の腕", "わかる？", "上達"]) {
      expect(html).not.toContain(leaked);
    }
    // 概要理解 4 pilihan, 即時応答 3 pilihan.
    expect(bodyOf(html)).toMatch(/1番<\/span><span class="bub">(<span>\d<\/span>){4}<\/span>/);
    expect(bodyOf(html)).toMatch(/1番<\/span><span class="bub">(<span>\d<\/span>){3}<\/span>/);
  });

  it("tidak pernah mencetak teks wacana choukai (transkrip 【音声】)", () => {
    const transcript = context("【音声】毎年各地で開催されるマラソン大会を紹介します。");
    const html = render(
      pkg([
        item("CHOUKAI_INTEGRATED", "CHOUKAI", [
          question({ questionContext: transcript }),
          question({ questionText: "質問1", questionContext: transcript, choices: ["北町", "東町", "南町", "西町"] }),
        ]),
      ]),
    );
    expect(html).not.toContain("マラソン");
  });

  it("統合理解: hanya 質問1/質問2 yang pilihannya tercetak, dan berbagi satu nomor 番", () => {
    const html = render(
      pkg(
        [
          item("CHOUKAI_INTEGRATED", "CHOUKAI", [
            question({ questionText: "このレストランではどうすることにしましたか。", choices: ["サラダを変える", "廃止", "値上げ", "全体"] }),
            question({ questionText: "質問1：男の学生はどの店に行きたいと言っていますか。", choices: ["島田書店", "森山書店", "南ブックス", "北川ブックス"] }),
            question({ questionText: "質問2：女の学生はどの店に行きたいと言っていますか。", choices: ["島田書店", "森山書店", "南ブックス", "北川ブックス"] }),
          ]),
        ],
        "N1",
      ),
    );
    expect(html).not.toContain("サラダ");
    expect(html).not.toContain("行きたい");
    expect(html).toContain("2番 質問1");
    expect(html).toContain("2番 質問2");
    expect(html).toContain("島田書店");
    // Lembar jawab memakai nomor yang sama.
    expect(html).toContain("<th>2(1)</th>");
    expect(html).toContain("<th>2(2)</th>");
  });
});

describe("branding", () => {
  const sample = () =>
    pkg([item("MOJI_GOI_CONTEXT", "MOJI_GOI", [question({ questionText: "えいがの（　）を 2まい かいました。", choices: ["ケーキ", "チケット", "ギター", "タクシー"] })])]);

  it("tanpa branding: nama dan domain situs tidak muncul di mana pun, termasuk <title>", () => {
    const html = render(sample());
    expect(html).not.toMatch(/nihongofy/i);
    expect(html).not.toContain("lans.my.id");
    expect(html).toContain("<title>JLPT N5 - 2024年07月</title>");
  });

  it("dengan branding: judul, kepala halaman, kaki halaman, dan lembar jawab", () => {
    const html = render(sample(), true);
    expect(html).toContain("<title>JLPT N5 - 2024年07月 | Nihongofy</title>");
    expect(html).toContain('@bottom-left { content: "Nihongofy · jlpt.lans.my.id"');
    expect(bodyOf(html).match(/class="brand">Nihongofy<small>jlpt\.lans\.my\.id<\/small>/g)).toHaveLength(2);
  });

  it("selalu mengisi margin box atas dan bawah supaya Chrome tidak mencetak URL/tanggal", () => {
    const html = render(sample());
    expect(html).toContain('@top-center { content: ""; }');
    expect(html).toContain("@bottom-center { content: counter(page)");
  });
});

describe("teks soal", () => {
  it("membuang furigana di 文字・語彙 supaya cara baca 漢字読み tidak bocor", () => {
    const html = render(
      pkg([
        item("MOJI_GOI_READ_KANJI", "MOJI_GOI", [
          question({ questionText: "いま __{店|みせ}__の まえに います。", choices: ["いえ", "えき", "みせ", "へや"] }),
        ]),
      ]),
    );
    expect(bodyOf(html)).toContain("<u>店</u>");
    expect(bodyOf(html)).not.toContain("<rt>");
  });

  it("furigana tampil di 読解 N5, tetapi tidak di N1", () => {
    const reading = () => [
      item("DOKKAI_SHORT_TEXT", "DOKKAI", [
        question({
          questionText: "{私|わたし}は どうしますか。",
          questionContext: context("{学生|がくせい}の ころ。"),
          choices: ["a", "b", "c", "d"],
        }),
      ]),
    ];
    expect(render(pkg(reading(), "N5"))).toContain("<ruby>学生<rt>がくせい</rt></ruby>");
    expect(bodyOf(render(pkg(reading(), "N1")))).not.toContain("<rt>");
  });

  it("meng-escape HTML dari data dan mengabaikan URL gambar non-http", () => {
    const html = render(
      pkg([
        item("DOKKAI_SHORT_TEXT", "DOKKAI", [
          question({
            questionText: '<script>alert("x")</script>',
            questionImage: "javascript:alert(1)",
            choices: ["<b>1</b>", "b", "c", "d"],
          }),
        ]),
      ]),
    );
    expect(bodyOf(html)).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;1&lt;/b&gt;");
    expect(html).not.toContain("javascript:alert");
  });
});

describe("penomoran", () => {
  it("mengenali semua bentuk penanda kosong 文章の文法", () => {
    expect(blankMarkerNumbers("(22) ( 19 ) （41） [18] __48__ ＿50＿ ＿＿21＿＿")).toEqual([22, 19, 41, 18, 48, 50, 21]);
  });

  it("hanya mengganti penanda yang nomornya termasuk soal mondai itu", () => {
    expect(replaceBlankMarkers("（1）作文 … 駅の 近く (14) 新しい", new Set([14]), (n) => `[${n}]`)).toBe(
      "（1）作文 … 駅の 近く [14] 新しい",
    );
  });

  it("berlanjut per sesi, mengikuti nomor di bacaan 文章の文法, dan mulai ulang per mondai di 聴解", () => {
    const grammar = [question({ choices: ["a", "b", "c", "d"] }), question({ choices: ["a", "b", "c", "d"] })];
    const passage = context("駅の 近く （41） 新しい。また （42）。");
    const cloze = [
      question({ questionText: "（41）", questionContext: passage, choices: ["a", "b", "c", "d"] }),
      question({ questionText: "（42）", questionContext: passage, choices: ["a", "b", "c", "d"] }),
    ];
    const reading = [question({ questionText: "どうしますか。", choices: ["a", "b", "c", "d"] })];
    const listening = [question(), question()];
    const items = [
      item("BUNPOU_GRAMMAR", "BUNPOU", grammar, { session: 1, order: 1 }),
      item("BUNPOU_TEXT_GRAMMAR", "BUNPOU", cloze, { session: 1, order: 2 }),
      item("DOKKAI_SHORT_TEXT", "DOKKAI", reading, { session: 1, order: 3 }),
      item("CHOUKAI_QUICK_RESPONSE", "CHOUKAI", listening, { session: 2, order: 1 }),
    ];

    const labels = labelQuestions(items);
    const numbers = items.flatMap((entry) => entry.questions.map((entry) => labels.get(entry.id)?.number));
    expect(numbers).toEqual(["1", "2", "41", "42", "43", "1", "2"]);

    const html = render(pkg(items, "N1"));
    expect(html).toContain('<span class="blank">41</span>');
    expect(html).toContain('<span class="blank">42</span>');
  });
});

describe("kunci jawaban", () => {
  it("menghitamkan bulatan jawaban benar pada baris yang nomornya sama dengan lembar jawab", () => {
    const first = question({ questionText: "えいがの（　）を かいました。", choices: ["a", "b", "c", "d"] });
    const second = question({ questionText: "どうしますか。", choices: ["a", "b", "c", "d"] });
    const value = pkg([item("MOJI_GOI_CONTEXT", "MOJI_GOI", [first, second])]);

    const key = bodyOf(renderKey(value, { [first.id]: 3, [second.id]: 1 }));
    expect(key).toContain(
      '<tr><th>1</th><td><span class="as-b"><span>1</span><span>2</span><span class="ans">3</span><span>4</span></span></td></tr>',
    );
    expect(key).toContain(
      '<tr><th>2</th><td><span class="as-b"><span class="ans">1</span><span>2</span><span>3</span><span>4</span></span></td></tr>',
    );
    // Lembar soal tidak pernah membawa kunci.
    expect(render(value)).not.toContain('class="ans"');
  });

  it("memakai penomoran lembar jawab: nomor bacaan 文章の文法 dan 質問 統合理解", () => {
    const passage = context("駅の 近く （41） 新しい。");
    const cloze = question({ questionText: "（41）", questionContext: passage, choices: ["a", "b", "c", "d"] });
    const audioOnly = question();
    const sub = question({ questionText: "質問1", choices: ["a", "b", "c", "d"] });
    const value = pkg(
      [
        item("BUNPOU_TEXT_GRAMMAR", "BUNPOU", [cloze]),
        item("CHOUKAI_INTEGRATED", "CHOUKAI", [audioOnly, sub], { session: 2 }),
      ],
      "N1",
    );

    const key = bodyOf(renderKey(value, { [cloze.id]: 2, [audioOnly.id]: 4, [sub.id]: 3 }));
    expect(key).toMatch(/<th>41<\/th><td><span class="as-b"><span>1<\/span><span class="ans">2<\/span>/);
    expect(key).toMatch(/<th>2\(1\)<\/th><td><span class="as-b"><span>1<\/span><span>2<\/span><span class="ans">3<\/span>/);
    expect(key).toMatch(/<th>1<\/th><td><span class="as-b">(<span>\d<\/span>){3}<span class="ans">4<\/span>/);
  });

  it("dokumen terpisah: tanpa soal, tanpa isian nama, judul diberi 正答表", () => {
    const value = pkg([
      item("MOJI_GOI_CONTEXT", "MOJI_GOI", [question({ questionText: "えいがの（　）を かいました。", choices: ["ケーキ", "チケット", "ギター", "タクシー"] })]),
    ]);
    const html = renderKey(value);
    expect(html).toContain("<title>JLPT N5 - 2024年07月 正答表</title>");
    expect(bodyOf(html)).toContain('<section class="as key">');
    for (const absent of ["えいが", "チケット", "なまえ", "doc-head"]) {
      expect(bodyOf(html)).not.toContain(absent);
    }
    expect(html).not.toMatch(/nihongofy/i);
    expect(renderKey(value, {}, true)).toContain("<title>JLPT N5 - 2024年07月 正答表 | Nihongofy</title>");
  });

  it("jawaban di luar jumlah pilihan mondai tetap terlihat", () => {
    const odd = question({ choices: ["", "", ""] });
    const key = bodyOf(renderKey(pkg([item("CHOUKAI_QUICK_RESPONSE", "CHOUKAI", [odd])]), { [odd.id]: 4 }));
    expect(key).toContain('<span>1</span><span>2</span><span>3</span><span class="ans">4</span>');
  });
});

describe("parameter halaman cetak", () => {
  it("default lembar soal tanpa branding; dokumen lain ditolak", () => {
    expect(PrintTestPackageQuerySchema.parse({})).toEqual({ document: "questions", branding: false });
    expect(PrintTestPackageQuerySchema.parse({ document: "answer-key", branding: "1" })).toEqual({
      document: "answer-key",
      branding: true,
    });
    expect(PrintTestPackageQuerySchema.safeParse({ document: "explanations" }).success).toBe(false);
  });
});
