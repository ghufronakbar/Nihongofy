import { markupToPlainText } from "@/lib/japanese-plain-text";
import type { ArticleBodyBlock } from "../schemas";

export function articleBodyToPlainText(blocks: ArticleBodyBlock[]): string {
  return blocks
    .flatMap((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
          return [block.text, block.japanese];
        case "quote":
          return [block.text, block.japanese, block.attribution];
        case "list":
          return [...block.items, ...(block.japaneseItems ?? [])];
        case "example":
          return [block.japanese, block.reading, block.translation, block.note];
        case "callout":
          return [block.title, block.text, block.japaneseTitle, block.japanese];
        case "image":
          return [block.alt, block.caption, block.japaneseCaption];
      }
    })
    .filter((text): text is string => Boolean(text))
    .map(markupToPlainText)
    .join("\n");
}

export function slugifyArticleValue(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
