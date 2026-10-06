import { Fragment, type ReactNode } from "react";
import { parseJapaneseMarkup, type MarkupSegment } from "@/lib/japanese-markup";

const DEFAULT_UNDERLINE_CLASS = "underline underline-offset-4";

function renderSegments(
  segments: MarkupSegment[],
  opts: { underlineClassName: string },
): ReactNode {
  return segments.map((segment, index) => {
    switch (segment.type) {
      case "text":
        return <Fragment key={index}>{segment.value}</Fragment>;

      case "furigana":
        return (
          <ruby key={index}>
            {segment.kanji}
            <rt>{segment.reading}</rt>
          </ruby>
        );

      case "underline":
        return (
          <span key={index} className={opts.underlineClassName}>
            {renderSegments(segment.children, opts)}
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
  underlineClassName = DEFAULT_UNDERLINE_CLASS,
): ReactNode {
  return renderSegments(parseJapaneseMarkup(text), { underlineClassName });
}

export function JapaneseText({
  text,
  underlineClassName,
  className,
}: {
  text: string;
  underlineClassName?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {renderInlineJapanese(text, underlineClassName)}
    </span>
  );
}
