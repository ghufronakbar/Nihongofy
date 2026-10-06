export type MarkupSegment =
  | { type: "text"; value: string }
  | { type: "furigana"; kanji: string; reading: string }
  | { type: "underline"; children: MarkupSegment[] }
  | { type: "slot"; kind: "blank" | "star" };

// Markup rules: see docs/database.md "Markup Teks Jepang".
// {漢字|かんじ} -> furigana, __teks__ -> underline, [_] / [★] -> literal slots.
// Underline may nest furigana (e.g. __{勉強|べんきょう}する__).
export function parseJapaneseMarkup(source: string): MarkupSegment[] {
  const segments: MarkupSegment[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      segments.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < source.length) {
    if (source.startsWith("[_]", i)) {
      flush();
      segments.push({ type: "slot", kind: "blank" });
      i += 3;
      continue;
    }

    if (source.startsWith("[★]", i)) {
      flush();
      segments.push({ type: "slot", kind: "star" });
      i += 3;
      continue;
    }

    if (source.startsWith("__", i)) {
      const closeIndex = source.indexOf("__", i + 2);
      if (closeIndex !== -1) {
        flush();
        const inner = source.slice(i + 2, closeIndex);
        segments.push({ type: "underline", children: parseJapaneseMarkup(inner) });
        i = closeIndex + 2;
        continue;
      }
    }

    if (source[i] === "{") {
      const pipeIndex = source.indexOf("|", i + 1);
      const closeIndex = source.indexOf("}", i + 1);
      if (pipeIndex !== -1 && closeIndex !== -1 && pipeIndex < closeIndex) {
        flush();
        segments.push({
          type: "furigana",
          kanji: source.slice(i + 1, pipeIndex),
          reading: source.slice(pipeIndex + 1, closeIndex),
        });
        i = closeIndex + 1;
        continue;
      }
    }

    buffer += source[i];
    i += 1;
  }

  flush();
  return segments;
}

/**
 * Markup yang sama tanpa furigana (kanjinya tetap), underline dan slot utuh:
 * `__{人脈|じんみゃく}__を{広|ひろ}げる` → `__人脈__を広げる`.
 *
 * Untuk payload soal di mode kerja (exam dan latihan): furigana hanya tampil saat
 * review atau mode baca. Dibuang di server, bukan hanya tidak dirender, karena
 * props Client Component terkirim utuh di RSC payload, dan pada 漢字読み cara baca
 * kata bergaris bawah adalah jawabannya.
 */
export function withoutFurigana(source: string): string {
  const serialize = (segments: MarkupSegment[]): string =>
    segments
      .map((segment) => {
        switch (segment.type) {
          case "text":
            return segment.value;
          case "furigana":
            return segment.kanji;
          case "underline":
            return `__${serialize(segment.children)}__`;
          case "slot":
            return segment.kind === "blank" ? "[_]" : "[★]";
        }
      })
      .join("");
  return serialize(parseJapaneseMarkup(source));
}

/** `withoutFurigana` untuk semua teks satu soal: soal, bacaan bersama, dan pilihan jawaban. */
export function withoutQuestionFurigana<
  T extends {
    questionText: string;
    questionContext: { storyText: string | null } | null;
    questionChoices: { answerText: string }[];
  },
>(question: T): T {
  return {
    ...question,
    questionText: withoutFurigana(question.questionText),
    questionContext: question.questionContext && {
      ...question.questionContext,
      storyText: question.questionContext.storyText && withoutFurigana(question.questionContext.storyText),
    },
    questionChoices: question.questionChoices.map((choice) => ({
      ...choice,
      answerText: withoutFurigana(choice.answerText),
    })),
  };
}

/** Teks polos tanpa furigana dan penanda, mis. untuk TTS: `{食|た}べ__ながら__` → `食べながら`. */
export function toPlainJapanese(source: string): string {
  const flatten = (segments: MarkupSegment[]): string =>
    segments
      .map((segment) => {
        switch (segment.type) {
          case "text":
            return segment.value;
          case "furigana":
            return segment.kanji;
          case "underline":
            return flatten(segment.children);
          case "slot":
            return "";
        }
      })
      .join("");
  return flatten(parseJapaneseMarkup(source));
}
