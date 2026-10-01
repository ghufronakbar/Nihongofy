import { Fragment, type ReactNode } from "react";
import { parseJapaneseMarkup, type MarkupSegment } from "@/lib/japanese-markup";

const DEFAULT_UNDERLINE_CLASS = "underline underline-offset-4";

function renderSegments(
  segments: MarkupSegment[],
  opts: { hideFuriganaInUnderline: boolean; insideUnderline: boolean; underlineClassName: string },
): ReactNode {
  return segments.map((segment, index) => {
    switch (segment.type) {
      case "text":
        return <Fragment key={index}>{segment.value}</Fragment>;

      case "furigana":
        // MOJI_GOI_READ_KANJI: furigana inside __underline__ is the answer itself
        // and must stay hidden while the question is being worked on.
        if (opts.insideUnderline && opts.hideFuriganaInUnderline) {
          return <Fragment key={index}>{segment.kanji}</Fragment>;
        }
        return (
          <ruby key={index}>
            {segment.kanji}
            <rt>{segment.reading}</rt>
          </ruby>
        );

      case "underline":
        return (
          <span key={index} className={opts.underlineClassName}>
            {renderSegments(segment.children, { ...opts, insideUnderline: true })}
          </span>
        );

      case "slot":
        return (
          <span
            key={index}
            className="mx-1 inline-block min-w-12 border-b border-foreground text-center"
          >
            {segment.kind === "star" ? "★" : " "}
          </span>
        );
    }
  });
}

// Shared with JapanesePassage (japanese-passage.tsx), which renders one line/cell at a time.
// `underlineClassName` lets contexts that use __...__ as a highlight (flashcard
// example sentences mark the target word) style it differently from exam
// questions, where it is the literal 下線部 underline.
export function renderInlineJapanese(
  text: string,
  hideFuriganaInUnderline = false,
  underlineClassName = DEFAULT_UNDERLINE_CLASS,
): ReactNode {
  const segments = parseJapaneseMarkup(text);
  return renderSegments(segments, {
    hideFuriganaInUnderline,
    insideUnderline: false,
    underlineClassName,
  });
}

export function JapaneseText({
  text,
  hideFuriganaInUnderline = false,
  underlineClassName,
  className,
}: {
  text: string;
  hideFuriganaInUnderline?: boolean;
  underlineClassName?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {renderInlineJapanese(text, hideFuriganaInUnderline, underlineClassName)}
    </span>
  );
}
