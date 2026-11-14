import type { NumberedItem, NumberedQuestion } from "./types";

// Penomoran dipakai bersama oleh lembar soal dan lembar jawab, supaya nomor
// yang dicari peserta di kedua lembar selalu sama.

// Penanda kotak kosong 文章の文法, di bacaan maupun di soal. Bentuknya beragam
// antar fixture: (22), ( 19 ), （41）, [18], __48__, ＿50＿, ＿＿21＿＿.
const BLANK_MARKER =
  /\(\s*(\d{1,3})\s*\)|（\s*(\d{1,3})\s*）|\[\s*(\d{1,3})\s*\]|＿+\s*(\d{1,3})\s*＿+|__\s*(\d{1,3})\s*__/g;

function markerValue(groups: unknown[]): number {
  const raw = groups.slice(0, 5).find((group): group is string => typeof group === "string");
  return Number(raw);
}

export function blankMarkerNumbers(text: string): number[] {
  return [...text.matchAll(BLANK_MARKER)].map((match) => markerValue(match.slice(1)));
}

/**
 * Ganti penanda kosong yang nomornya ada di `numbers`. Penanda lain (mis. judul
 * "(1)" atau tahun dalam kurung) dibiarkan apa adanya.
 */
export function replaceBlankMarkers(
  text: string,
  numbers: ReadonlySet<number>,
  replace: (value: number) => string,
): string {
  return text.replace(BLANK_MARKER, (match: string, ...groups: unknown[]) => {
    const value = markerValue(groups);
    return numbers.has(value) ? replace(value) : match;
  });
}

// 統合理解 bagian akhir (3番) berisi 質問1 dan 質問2 dengan pilihan tercetak.
const INTEGRATED_SUBQUESTION = /^\s*質問\s*([1-9１-９])/;

/** Nomor 質問 (1, 2, ...) pada 統合理解 choukai, atau `null` bila bukan sub-soal. */
export function integratedSubquestion(
  item: Pick<NumberedItem, "mondaiType">,
  question: Pick<NumberedQuestion, "questionText">,
): number | null {
  if (item.mondaiType !== "CHOUKAI_INTEGRATED") return null;
  const match = question.questionText.match(INTEGRATED_SUBQUESTION);
  if (!match) return null;
  return Number(match[1].replace(/[１-９]/, (digit) => String(digit.charCodeAt(0) - 0xff10)));
}

export type QuestionLabel = {
  /** Nomor soal: berlanjut per sesi untuk 言語知識・読解, per mondai untuk 聴解. */
  number: string;
  /** "質問1" / "質問2" untuk 統合理解 choukai, selain itu `null`. */
  sub: string | null;
};

export function sortedItems<I extends NumberedItem>(items: readonly I[]): I[] {
  return [...items].sort((a, b) => a.session - b.session || a.order - b.order);
}

export function sortedQuestions<Q extends NumberedQuestion>(item: { questions: readonly Q[] }): Q[] {
  return [...item.questions].sort((a, b) => a.order - b.order);
}

export function labelQuestions(items: readonly NumberedItem[]): Map<number, QuestionLabel> {
  const labels = new Map<number, QuestionLabel>();
  let session: number | null = null;
  let counter = 0;

  for (const item of sortedItems(items)) {
    if (item.session !== session) {
      session = item.session;
      counter = 0;
    }

    if (item.section === "CHOUKAI") {
      // Nomor 番 mengikuti `order` (sama dengan yang diucapkan audio), kecuali
      // 統合理解: 質問1 dan 質問2 berbagi satu nomor 番.
      let ban = 0;
      for (const question of sortedQuestions(item)) {
        const sub = integratedSubquestion(item, question);
        if (item.mondaiType !== "CHOUKAI_INTEGRATED") ban = question.order;
        else if (sub === null || sub === 1 || ban === 0) ban += 1;
        labels.set(question.id, { number: String(ban), sub: sub === null ? null : `質問${sub}` });
      }
      continue;
    }

    for (const question of sortedQuestions(item)) {
      // 文章の文法 memakai nomor yang tertulis di bacaannya, supaya kotak di
      // bacaan dan nomor soal tetap cocok walau paket rekonstruksi kurang soal.
      const marked =
        item.mondaiType === "BUNPOU_TEXT_GRAMMAR"
          ? blankMarkerNumbers(question.questionText)[0]
          : undefined;
      counter = marked !== undefined && marked > counter ? marked : counter + 1;
      labels.set(question.id, { number: String(counter), sub: null });
    }
  }

  return labels;
}
