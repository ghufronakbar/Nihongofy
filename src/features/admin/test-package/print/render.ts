import type { JlptLevel, JlptSection, MondaiType } from "@prisma/client";
import { parseJapaneseDocument, type DocumentBlock } from "@/lib/japanese-document";
import { parseJapaneseMarkup, type MarkupSegment } from "@/lib/japanese-markup";
import {
  integratedSubquestion,
  labelQuestions,
  replaceBlankMarkers,
  sortedItems,
  sortedQuestions,
  type QuestionLabel,
} from "./numbering";
import { printStyles } from "./styles";
import type {
  AnswerKeyPackage,
  NumberedItem,
  PrintBranding,
  PrintChoice,
  PrintItem,
  PrintPackage,
  PrintQuestion,
} from "./types";

// Lembar soal + lembar jawab (gaya LJK), dan kunci jawaban terpisah, masing-masing
// sebagai dokumen HTML mandiri yang dicetak browser ke PDF. Sengaja bukan
// @react-pdf: furigana (<ruby>) dan pemenggalan teks Jepang hanya benar di mesin
// layout browser.

export type RenderPrintOptions = {
  branding: PrintBranding | null;
};

// ---------- teks ----------

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (value: string) => escapeHtml(value).replace(/"/g, "&quot;");

// Kotak kosong 文章の文法 dibawa lewat karakter private-use supaya lolos parser
// markup (penanda __48__ tidak terbaca sebagai garis bawah) lalu jadi kotak.
const BLANK_OPEN = "";
const BLANK_CLOSE = "";
const blankToken = (value: number) => `${BLANK_OPEN}${value}${BLANK_CLOSE}`;
const BLANK_TOKEN = new RegExp(`${BLANK_OPEN}(\\d+)${BLANK_CLOSE}`, "g");

type TextOptions = { furigana: boolean };

function renderSegments(segments: MarkupSegment[], options: TextOptions): string {
  return segments
    .map((segment) => {
      switch (segment.type) {
        case "text":
          return escapeHtml(segment.value).replace(/\n/g, "<br>");
        case "furigana":
          return options.furigana
            ? `<ruby>${escapeHtml(segment.kanji)}<rt>${escapeHtml(segment.reading)}</rt></ruby>`
            : escapeHtml(segment.kanji);
        case "underline":
          return `<u>${renderSegments(segment.children, options)}</u>`;
        case "slot":
          return segment.kind === "star" ? `<span class="slot">★</span>` : `<span class="slot"></span>`;
      }
    })
    .join("");
}

function renderInline(source: string, options: TextOptions): string {
  return renderSegments(parseJapaneseMarkup(source), options).replace(
    BLANK_TOKEN,
    '<span class="blank">$1</span>',
  );
}

function renderPassage(text: string, options: TextOptions): string {
  const renderBlocks = (blocks: DocumentBlock[]): string =>
    blocks
      .map((block) => {
        switch (block.type) {
          case "paragraph":
            return `<div class="p">${block.lines.map((line) => `<div>${renderInline(line, options)}</div>`).join("")}</div>`;
          case "table":
            return (
              `<table><thead><tr>${block.headers.map((cell) => `<th>${renderInline(cell, options)}</th>`).join("")}</tr></thead><tbody>` +
              block.rows
                .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell, options)}</td>`).join("")}</tr>`)
                .join("") +
              `</tbody></table>`
            );
          case "section":
            return `<div class="sec"><div class="sec-label">【${escapeHtml(block.label)}】</div>${renderBlocks(block.blocks)}</div>`;
        }
      })
      .join("");
  return renderBlocks(parseJapaneseDocument(text));
}

// Lebar tampil dalam em: karakter ASCII kira-kira setengah lebar kana/kanji.
function emLength(source: string): number {
  const visible = source
    .replace(/\{([^|}]*)\|[^}]*\}/g, "$1")
    .replace(/__/g, "")
    .replace(/\[_\]|\[★\]/g, "　".repeat(5));
  return [...visible].reduce((total, char) => total + (char.charCodeAt(0) < 128 ? 0.55 : 1), 0);
}

const isHttpUrl = (value: string | null): value is string =>
  value !== null && /^https?:\/\//i.test(value.trim());

const image = (url: string, className: string) =>
  `<img class="${className}" src="${escapeAttr(url.trim())}" alt="">`;

// ---------- aturan per level & mondai ----------

const KANJI_LABELS: JlptLevel[] = ["N1", "N2", "N3"];

// Kertas N4/N5 memberi furigana di 文法・読解 dan 聴解; N1–N3 tidak. Di 文字・語彙
// furigana selalu dibuang — pada 漢字読み cara baca kata bergaris bawah adalah jawabannya.
function showFurigana(level: JlptLevel, section: JlptSection): boolean {
  return section !== "MOJI_GOI" && !KANJI_LABELS.includes(level);
}

const mondaiLabel = (level: JlptLevel, order: number) =>
  KANJI_LABELS.includes(level) ? `問題${order}` : `もんだい${order}`;
const banLabel = (level: JlptLevel, number: string) =>
  KANJI_LABELS.includes(level) ? `${number}番` : `${number}ばん`;

const THREE_OPTION_TYPES: MondaiType[] = ["CHOUKAI_EXPRESSION", "CHOUKAI_QUICK_RESPONSE"];
const optionCount = (mondaiType: MondaiType) => (THREE_OPTION_TYPES.includes(mondaiType) ? 3 : 4);

const SECTION_LABEL: Record<JlptSection, string> = {
  MOJI_GOI: "文字・語彙",
  BUNPOU: "文法",
  DOKKAI: "読解",
  CHOUKAI: "聴解",
};

function sessionTitle(sections: JlptSection[]): string {
  if (sections.includes("CHOUKAI")) return SECTION_LABEL.CHOUKAI;
  const language = (["MOJI_GOI", "BUNPOU"] as const)
    .filter((section) => sections.includes(section))
    .map((section) => SECTION_LABEL[section]);
  const parts: string[] = [];
  if (language.length) parts.push(`言語知識（${language.join("・")}）`);
  if (sections.includes("DOKKAI")) parts.push(SECTION_LABEL.DOKKAI);
  return parts.join("・");
}

// ---------- pilihan jawaban ----------

type ChoiceWidth = "full" | "half" | "halfRow";
// Batas panjang pilihan (em) untuk 4 kolom / 2 kolom, per lebar wadah (A4, 10pt).
const CHOICE_FIT: Record<ChoiceWidth, [number, number]> = {
  full: [10, 22],
  half: [4.2, 11],
  halfRow: [0, 9.5],
};

function choiceColumns(choices: PrintChoice[], width: ChoiceWidth): string {
  if (choices.some((choice) => isHttpUrl(choice.answerImage))) return "c2";
  const lengths = choices.map((choice) => emLength(choice.answerText));
  const max = Math.max(...lengths);
  // Di samping label "N番" tersisa ±21em: satu baris dengan lebar sesuai isi bila muat.
  if (
    width === "halfRow" &&
    lengths.reduce((total, length) => total + length, 0) + lengths.length * 0.9 + (lengths.length - 1) * 0.85 <= 21
  )
    return "c4a";
  const [four, two] = CHOICE_FIT[width];
  if (max <= four) return "c4";
  if (max <= two) return "c2";
  return "c1";
}

function renderChoices(choices: PrintChoice[], options: TextOptions, width: ChoiceWidth = "full"): string {
  const sorted = [...choices].sort((a, b) => a.codeAnswer - b.codeAnswer);
  return `<div class="ch ${choiceColumns(sorted, width)}">${sorted
    .map(
      (choice) =>
        `<div><span class="cn">${choice.codeAnswer}</span>${renderInline(choice.answerText, options)}${
          isHttpUrl(choice.answerImage) ? image(choice.answerImage, "chimg") : ""
        }</div>`,
    )
    .join("")}</div>`;
}

const hasPrintableChoices = (question: PrintQuestion) =>
  question.questionChoices.some((choice) => choice.answerText.trim() || isHttpUrl(choice.answerImage));

const bubbles = (count: number) =>
  `<span class="bub">${Array.from({ length: count }, (_, index) => `<span>${index + 1}</span>`).join("")}</span>`;

// Soal pendek dicetak satu baris: [no] soal … 1 a  2 b  3 c  4 d.
// Lebar isi A4 (188mm) pada 10pt ≈ 53em; dikurangi kotak nomor + jarak ≈ 48em.
const LINE_EM = 48;
const maxChoiceEm = (question: PrintQuestion) =>
  Math.max(...question.questionChoices.map((choice) => emLength(choice.answerText)));
const inlineCandidate = (question: PrintQuestion) =>
  !question.questionImage &&
  question.questionText.trim() !== "" &&
  !question.questionText.includes("\n") &&
  !question.questionChoices.some((choice) => isHttpUrl(choice.answerImage)) &&
  maxChoiceEm(question) <= 6;

// ---------- lembar soal ----------

type SheetContext = {
  level: JlptLevel;
  labels: Map<number, QuestionLabel>;
};

function mondaiHead(item: PrintItem, level: JlptLevel, options: TextOptions): string {
  return `<div class="mh"><span class="mn">${mondaiLabel(level, item.order)}</span><span class="ins">${renderInline(item.instruction ?? "", options)}</span></div>`;
}

function renderReadingItem(item: PrintItem, sheet: SheetContext, printedContexts: Set<number>): string {
  const options: TextOptions = { furigana: showFurigana(sheet.level, item.section) };
  const questions = sortedQuestions(item);
  const numberOf = (question: PrintQuestion) => sheet.labels.get(question.id)?.number ?? "";

  const isTextGrammar = item.mondaiType === "BUNPOU_TEXT_GRAMMAR";
  const blankNumbers = new Set(questions.map((question) => Number(numberOf(question))));
  const withBlanks = (text: string) =>
    isTextGrammar ? replaceBlankMarkers(text, blankNumbers, blankToken) : text;

  const inlineWidth =
    Math.max(0, ...questions.filter(inlineCandidate).map(maxChoiceEm)) + 1.4;

  const body = questions
    .map((question) => {
      let passage = "";
      const context = question.questionContext;
      if (context && !printedContexts.has(context.id) && (context.storyText?.trim() || isHttpUrl(context.storyImage))) {
        printedContexts.add(context.id);
        passage = `<div class="passage">${context.storyText ? renderPassage(withBlanks(context.storyText), options) : ""}${
          isHttpUrl(context.storyImage) ? image(context.storyImage, "pimg") : ""
        }</div>`;
      }

      const stem = withBlanks(question.questionText);
      // Soal 文章の文法 yang isinya hanya penanda "(22)" cukup diwakili kotak nomornya.
      const stemIsBlank = stem.replace(BLANK_TOKEN, "").trim() === "";
      const number = `<span class="qn">${numberOf(question)}</span>`;
      const questionImage = isHttpUrl(question.questionImage) ? image(question.questionImage, "qimg") : "";
      const choices = renderChoices(question.questionChoices, options);

      let block: string;
      if (stemIsBlank) {
        block = `<div class="q row">${number}${questionImage}${choices}</div>`;
      } else if (inlineCandidate(question) && emLength(stem) <= LINE_EM - 4 * inlineWidth) {
        block = `<div class="q line" style="--cw:${inlineWidth}em">${number}<span class="st">${renderInline(stem, options)}</span>${choices}</div>`;
      } else {
        block = `<div class="q"><div class="stem">${number}<span class="st">${renderInline(stem, options)}</span></div>${questionImage}${choices}</div>`;
      }
      // Bacaan selalu menempel dengan soal pertamanya, tidak terpisah halaman.
      return passage ? `<div class="keep">${passage}${block}</div>` : block;
    })
    .join("");

  return `<section class="mondai"><div class="keep">${mondaiHead(item, sheet.level, options)}</div>${body}</section>`;
}

// Yang dicetak di kertas 聴解 asli hanya gambar dan pilihan untuk 課題理解/ポイント理解,
// gambar untuk 発話表現, serta pilihan 質問1/質問2 di 統合理解. Pertanyaan, 概要理解,
// 即時応答, dan teks wacana choukai (sering berupa transkrip 「【音声】…」) hanya ada di
// audio, jadi tidak pernah dicetak walau datanya tersedia.
function renderListeningItem(item: PrintItem, sheet: SheetContext, printedContexts: Set<number>): string {
  const options: TextOptions = { furigana: showFurigana(sheet.level, item.section) };
  const questions = sortedQuestions(item);
  const head = `<div class="keep">${mondaiHead(item, sheet.level, options)}</div>`;
  const label = (question: PrintQuestion) => {
    const questionLabel = sheet.labels.get(question.id);
    const ban = banLabel(sheet.level, questionLabel?.number ?? String(question.order));
    return `<span class="ban">${questionLabel?.sub ? `${ban} ${questionLabel.sub}` : ban}</span>`;
  };
  const count = optionCount(item.mondaiType);

  if (item.mondaiType === "CHOUKAI_QUICK_RESPONSE" || item.mondaiType === "CHOUKAI_OUTLINE") {
    return `<section class="mondai">${head}<div class="qr">${questions
      .map((question) => `<div>${label(question)}${bubbles(count)}</div>`)
      .join("")}</div></section>`;
  }

  if (item.mondaiType === "CHOUKAI_EXPRESSION") {
    return `<section class="mondai">${head}<div class="ex">${questions
      .map(
        (question) =>
          `<figure><figcaption>${label(question)}${bubbles(count)}</figcaption>${
            isHttpUrl(question.questionImage) ? image(question.questionImage, "") : ""
          }</figure>`,
      )
      .join("")}</div></section>`;
  }

  // 課題理解, ポイント理解, 統合理解: dua kolom mengalir.
  const blocks = questions.map((question) => {
    let shared = "";
    const context = question.questionContext;
    if (context && !printedContexts.has(context.id) && isHttpUrl(context.storyImage)) {
      printedContexts.add(context.id);
      shared = `<div class="cq">${image(context.storyImage, "cimg")}</div>`;
    }

    let block: string;
    if (item.mondaiType === "CHOUKAI_INTEGRATED") {
      // Hanya 質問1/質問2 yang pilihannya tercetak; 1番/2番 murni audio.
      block =
        integratedSubquestion(item, question) !== null && hasPrintableChoices(question)
          ? `<div class="cq row">${label(question)}${renderChoices(question.questionChoices, options, "halfRow")}</div>`
          : `<div class="cq row">${label(question)}${bubbles(count)}</div>`;
    } else if (isHttpUrl(question.questionImage)) {
      // Gambar choukai sudah memuat pilihan 1–4, jadi teks pilihan tidak diulang.
      block = `<div class="cq">${label(question)}${image(question.questionImage, "cimg")}</div>`;
    } else if (hasPrintableChoices(question)) {
      block = `<div class="cq row">${label(question)}${renderChoices(question.questionChoices, options, "halfRow")}</div>`;
    } else {
      block = `<div class="cq row">${label(question)}${bubbles(count)}</div>`;
    }
    return shared + block;
  });

  return `<section class="mondai">${head}<div class="cols">${blocks.join("")}</div></section>`;
}

function renderQuestionSheet(pkg: PrintPackage, sheet: SheetContext): string {
  const items = sortedItems(pkg.testPackageItems);
  const sessions = [...new Set(items.map((item) => item.session))];
  return sessions
    .map((session, index) => {
      const sessionItems = items.filter((item) => item.session === session);
      const printedContexts = new Set<number>();
      // Tiap sesi mulai di halaman baru (sesi pertama tetap di bawah judul paket).
      const title = `<h2${index === 0 ? "" : ' class="new-page"'}>${sessionTitle([
        ...new Set(sessionItems.map((item) => item.section)),
      ])}</h2>`;
      return (
        title +
        sessionItems
          .map((item) =>
            item.section === "CHOUKAI"
              ? renderListeningItem(item, sheet, printedContexts)
              : renderReadingItem(item, sheet, printedContexts),
          )
          .join("")
      );
    })
    .join("");
}

// ---------- lembar jawab (gaya LJK / 解答用紙) & kunci jawaban, satu halaman ----------

// Baris (soal + kepala mondai) per kolom sebelum satu sesi dipecah jadi beberapa
// kolom, supaya N1/N2 yang soalnya banyak tetap muat satu halaman.
const ANSWER_ROWS_PER_COLUMN = 42;

type AnswerSheetPackage = Pick<PrintPackage, "name" | "jlptLevel"> & {
  testPackageItems: readonly NumberedItem[];
};

/**
 * Lembar jawab kosong, atau kunci jawaban bila `answers` (id soal → nomor
 * jawaban benar) diisi: lembar yang sama persis dengan bulatan jawaban benar
 * dihitamkan, jadi bisa dicocokkan langsung dengan LJK peserta.
 */
function renderAnswerSheet(
  pkg: AnswerSheetPackage,
  labels: Map<number, QuestionLabel>,
  branding: PrintBranding | null,
  answers: ReadonlyMap<number, number> | null,
): string {
  const items = sortedItems(pkg.testPackageItems);
  const sessions = [...new Set(items.map((item) => item.session))];
  // Jawaban di luar jumlah pilihan mondai (data keliru) tetap dihitamkan supaya terlihat.
  const answerBubbles = (count: number, answer: number | undefined) =>
    `<span class="as-b">${Array.from({ length: 4 }, (_, index) => {
      const value = index + 1;
      if (value === answer) return `<span class="ans">${value}</span>`;
      return value <= count ? `<span>${value}</span>` : `<span class="none"></span>`;
    }).join("")}</span>`;

  const columns = sessions.map((session) => {
    const sessionItems = items.filter((item) => item.session === session);
    const rows = sessionItems.reduce((total, item) => total + item.questions.length + 1, 0);
    const span = Math.max(1, Math.ceil(rows / ANSWER_ROWS_PER_COLUMN));
    const tables = sessionItems
      .map((item) => {
        const count = optionCount(item.mondaiType);
        const body = sortedQuestions(item)
          .map((question) => {
            const questionLabel = labels.get(question.id);
            const sub = questionLabel?.sub?.replace("質問", "") ?? null;
            const number = `${questionLabel?.number ?? question.order}${sub ? `(${sub})` : ""}`;
            return `<tr><th>${number}</th><td>${answerBubbles(count, answers?.get(question.id))}</td></tr>`;
          })
          .join("");
        return `<table class="as-m"><thead><tr><th colspan="2">${mondaiLabel(pkg.jlptLevel, item.order)}</th></tr></thead><tbody>${body}</tbody></table>`;
      })
      .join("");
    return {
      span,
      html: `<div class="as-col"><div class="as-st">${sessionTitle([...new Set(sessionItems.map((item) => item.section))])}</div><div class="as-body" style="columns:${span}">${tables}</div></div>`,
    };
  });

  const brand = branding
    ? `<span class="brand">${escapeHtml(branding.name)}<small>${escapeHtml(branding.host)}</small></span>`
    : "";

  const grid = `<div class="as-grid" style="grid-template-columns:${columns.map((column) => `${column.span}fr`).join(" ")}">${columns.map((column) => column.html).join("")}</div>`;

  if (answers) {
    return `<section class="as key">
<div class="as-head"><div class="as-title">正答表 <small>Answer Key</small></div><div class="as-pkg">${escapeHtml(pkg.name)}${brand}</div></div>
${grid}
</section>`;
  }

  return `<section class="as">
<div class="as-head"><div class="as-title">かいとうようし <small>解答用紙</small></div><div class="as-pkg">${escapeHtml(pkg.name)}${brand}</div></div>
<div class="as-id"><div class="as-f"><span>なまえ<br><small>Name</small></span><div class="as-box"></div></div><div class="as-f num"><span>じゅけんばんごう<br><small>No.</small></span><div class="as-box"></div></div></div>
<div class="as-note"><b>ちゅうい Notes</b><ol><li>くろい えんぴつ（HB・No.2）で かいて ください。</li><li>かきなおす ときは、けしゴムで きれいに けして ください。</li><li>ひとつの もんだいに マークは ひとつだけ です。</li></ol>
<div class="as-ex"><span>よい れい</span><span class="as-b"><span class="fill"></span></span><span>わるい れい</span><span class="as-b"><span>✓</span><span>×</span><span class="half"></span><span>・</span></span></div></div>
${grid}
</section>`;
}

// ---------- dokumen ----------

// Dialog cetak dibuka otomatis setelah font dan semua gambar selesai dimuat,
// supaya PDF tidak tersimpan dengan gambar kosong.
const AUTO_PRINT_SCRIPT = `(() => {
  const images = Array.from(document.images, (img) => img.complete ? null : new Promise((done) => {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }));
  Promise.all([document.fonts.ready, ...images]).then(() => {
    document.documentElement.dataset.ready = "true";
    setTimeout(() => window.print(), 150);
  });
})();`;

// Judul dokumen = nama file usulan "Simpan sebagai PDF".
function renderDocument(title: string, branding: PrintBranding | null, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(branding ? `${title} | ${branding.name}` : title)}</title>
<style>${printStyles(branding)}</style>
</head>
<body>
<div class="toolbar"><span>Pratinjau cetak. Di dialog cetak pilih <b>Simpan sebagai PDF</b>, kertas <b>A4</b>, skala <b>100%</b>.</span><button type="button" onclick="window.print()">Cetak / Simpan PDF</button></div>
${body}
<script>${AUTO_PRINT_SCRIPT}</script>
</body>
</html>`;
}

/** Lembar soal per sesi + satu lembar jawab kosong. Tidak pernah memuat kunci. */
export function renderPrintableTestPackage(pkg: PrintPackage, options: RenderPrintOptions): string {
  const { branding } = options;
  const sheet: SheetContext = { level: pkg.jlptLevel, labels: labelQuestions(pkg.testPackageItems) };
  const brand = branding
    ? `<span class="brand">${escapeHtml(branding.name)}<small>${escapeHtml(branding.host)}</small></span>`
    : "";

  return renderDocument(
    pkg.name,
    branding,
    `<header class="doc-head"><h1>${escapeHtml(pkg.name)}</h1>${brand}</header>
${renderQuestionSheet(pkg, sheet)}
${renderAnswerSheet(pkg, sheet.labels, branding, null)}`,
  );
}

/** Kunci jawaban: lembar jawab yang sama dengan jawaban benar dihitamkan. */
export function renderAnswerKey(pkg: AnswerKeyPackage, options: RenderPrintOptions): string {
  const answers = new Map(
    pkg.testPackageItems.flatMap((item) =>
      item.questions.map((question) => [question.id, question.questionAnswer] as const),
    ),
  );
  return renderDocument(
    `${pkg.name} 正答表`,
    options.branding,
    renderAnswerSheet(pkg, labelQuestions(pkg.testPackageItems), options.branding, answers),
  );
}
