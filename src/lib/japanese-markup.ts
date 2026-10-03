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
 * Markup yang sama, tetapi furigana di dalam underline dibuang (kanjinya tetap):
 * `__{人脈|じんみゃく}__を{広|ひろ}げる` → `__人脈__を{広|ひろ}げる`.
 *
 * Untuk payload soal 漢字読み sebelum dijawab: di sana cara baca kata bergaris
 * bawah adalah jawabannya. `hideFuriganaInUnderline` hanya menyembunyikannya saat
 * render, sedangkan props Client Component tetap terkirim utuh di RSC payload.
 */
export function withoutUnderlineFurigana(source: string): string {
  const serialize = (segments: MarkupSegment[], insideUnderline: boolean): string =>
    segments
      .map((segment) => {
        switch (segment.type) {
          case "text":
            return segment.value;
          case "furigana":
            return insideUnderline ? segment.kanji : `{${segment.kanji}|${segment.reading}}`;
          case "underline":
            return `__${serialize(segment.children, true)}__`;
          case "slot":
            return segment.kind === "blank" ? "[_]" : "[★]";
        }
      })
      .join("");
  return serialize(parseJapaneseMarkup(source), false);
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
