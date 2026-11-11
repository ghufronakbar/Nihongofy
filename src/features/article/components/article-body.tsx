import Image from "next/image";
import type { ReactNode } from "react";
import { JapaneseText } from "@/components/japanese-text";
import { cn } from "@/lib/utils";
import type { ArticleBodyBlock } from "../schemas";

export type ArticleReadingMode = "id" | "ja" | "bilingual";
export function articleBlockId(block: ArticleBodyBlock, index: number) {
  return `bacaan-${block.key ?? index}`;
}
function Japanese({ text }: { text: string }) {
  return (
    <span lang="ja" className="font-japanese">
      <JapaneseText text={text} />
    </span>
  );
}

export function ArticleBody({
  blocks,
  mode = "id",
  showTranslations = false,
  parallel = false,
}: {
  blocks: ArticleBodyBlock[];
  mode?: ArticleReadingMode;
  showTranslations?: boolean;
  parallel?: boolean;
}) {
  function content(block: ArticleBodyBlock, ja: boolean): ReactNode {
    switch (block.type) {
      case "heading": {
        const Heading = block.level === 2 ? "h2" : "h3";
        return (
          <Heading>
            {ja && block.japanese ? <Japanese text={block.japanese} /> : block.text}
          </Heading>
        );
      }
      case "paragraph":
        return <p>{ja && block.japanese ? <Japanese text={block.japanese} /> : block.text}</p>;
      case "list": {
        const List = block.ordered ? "ol" : "ul";
        return (
          <List>
            {(ja && block.japaneseItems ? block.japaneseItems : block.items).map((item, i) => (
              <li key={i}>{ja ? <Japanese text={item} /> : item}</li>
            ))}
          </List>
        );
      }
      case "quote":
        return (
          <blockquote>
            <p>{ja && block.japanese ? <Japanese text={block.japanese} /> : block.text}</p>
            {block.attribution && <cite>{block.attribution}</cite>}
          </blockquote>
        );
      case "example":
        return (
          <div className="article-dialogue">
            {ja ? (
              <p>
                <Japanese text={block.japanese} />
              </p>
            ) : (
              <>
                <p>{block.translation}</p>
                {block.note && <small>{block.note}</small>}
              </>
            )}
          </div>
        );
      case "callout":
        return (
          <aside className="article-reading-note">
            <strong>
              {ja && block.japaneseTitle ? <Japanese text={block.japaneseTitle} /> : block.title}
            </strong>
            <p>{ja && block.japanese ? <Japanese text={block.japanese} /> : block.text}</p>
          </aside>
        );
      case "image":
        return (
          <figure>
            <Image
              src={block.src}
              alt={block.alt}
              width={1600}
              height={900}
              unoptimized={block.src.startsWith("https://")}
              className="h-auto w-full rounded-lg"
            />
            {(block.caption || block.japaneseCaption) && (
              <figcaption>
                {ja && block.japaneseCaption ? (
                  <Japanese text={block.japaneseCaption} />
                ) : (
                  block.caption
                )}
              </figcaption>
            )}
          </figure>
        );
    }
  }
  return (
    <div
      className={cn("article-reading-body", parallel && mode === "bilingual" && "article-parallel")}
    >
      {blocks.map((block, index) => (
        <div
          id={articleBlockId(block, index)}
          key={`${mode}-${block.key ?? index}`}
          className={cn(
            "article-reading-block",
            block.type === "heading" && "article-heading-block",
          )}
        >
          {mode === "bilingual" && block.type !== "image" ? (
            <>
              <div className="article-original">{content(block, true)}</div>
              {block.type === "heading" ? (
                <div className="article-heading-translation">{block.text}</div>
              ) : (
                <details className="article-translation" open={showTranslations || parallel}>
                  <summary>Terjemahan Indonesia</summary>
                  <div lang="id">{content(block, false)}</div>
                </details>
              )}
            </>
          ) : mode === "id" && block.type === "example" ? (
            <div className="article-example-pair">
              {content(block, true)}
              {content(block, false)}
            </div>
          ) : (
            content(block, mode === "ja")
          )}
        </div>
      ))}
    </div>
  );
}
