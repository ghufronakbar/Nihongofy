import type { ArticleBodyBlock } from "@/features/article/schemas";

// `Article.bodyText` adalah turunan datar dari `Article.body`, dipakai untuk
// search server-side (`contains`) karena JSONB tidak dapat dicari dengan cara
// yang sama. Tidak pernah diisi manual: selalu dihasilkan ulang setiap body
// berubah, baik lewat seed maupun lewat editor admin.
//
// PENTING: `prisma/seed-articles.mjs` memiliki salinan fungsi ini karena script
// seed berjalan sebagai .mjs dan tidak dapat mengimpor TypeScript. Kedua versi
// harus menghasilkan output yang sama — ubah keduanya bersamaan.
export function articleBodyToPlainText(blocks: ArticleBodyBlock[]): string {
  return blocks
    .flatMap((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
          return [block.text];
        case "quote":
          return [block.text, block.attribution].filter(Boolean);
        case "list":
          return block.items;
        case "example":
          return [block.japanese, block.reading, block.translation, block.note].filter(Boolean);
        case "callout":
          return [block.title, block.text];
        default:
          return [];
      }
    })
    .join("\n");
}

export function slugifyArticleValue(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
