import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { CreateArticleSchema } from "../src/features/admin/article/schemas.ts";
import { ArticleBodySchema } from "../src/features/article/schemas.ts";
import {
  articleBodyToPlainText,
  slugifyArticleValue,
} from "../src/features/article/lib/body-text.ts";

const file = fileURLToPath(
  new URL("../src/features/article/data/article-seed.json", import.meta.url),
);
const fixtureSchema = z
  .array(
    z
      .object({ body: ArticleBodySchema, publishedAt: z.iso.datetime() })
      .passthrough(),
  )
  .length(1);
async function main() {
  const raw = fixtureSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const articles = raw.map(({ body, publishedAt, ...fields }) => ({
    ...CreateArticleSchema.parse({ ...fields, bodyJson: JSON.stringify(body) }),
    body,
    publishedAt: new Date(publishedAt),
  }));
  if (process.argv.includes("--validate-only")) {
    console.info(
      `[seed:articles] Valid: ${articles.length} artikel bilingual lengkap, ${articles[0].body.length} blok, ${articles[0].glossary.length} kosakata.`,
    );
    return;
  }
  const prisma = new PrismaClient();
  try {
    for (const article of articles)
      await prisma.$transaction(async (tx) => {
        const data = {
          title: article.title,
          excerpt: article.excerpt,
          titleJa: article.titleJa || null,
          excerptJa: article.excerptJa || null,
          readingLevel: article.readingLevel || null,
          hasJapanese: Boolean(article.titleJa),
          body: article.body,
          bodyText: articleBodyToPlainText(article.body),
          glossary: article.glossary,
          coverImage: article.coverImage,
          coverAlt: article.coverAlt,
          coverCredit: article.coverCredit || null,
          coverCreditUrl: article.coverCreditUrl || null,
          authorName: article.authorName,
          authorRole: article.authorRole || null,
          category: article.category,
          categorySlug: slugifyArticleValue(article.category),
          status: article.status,
          isFeatured: article.isFeatured,
          discussionEnabled: article.discussionEnabled,
          publishedAt: article.publishedAt,
          readTime: article.readTime,
        };
        const stored = await tx.article.upsert({
          where: { slug: article.slug },
          create: { slug: article.slug, ...data },
          update: data,
          select: { id: true },
        });
        await tx.articleTagLink.deleteMany({ where: { articleId: stored.id } });
        for (const label of new Set(article.tags)) {
          const slug = slugifyArticleValue(label);
          const tag = await tx.articleTag.upsert({
            where: { slug },
            update: { label },
            create: { slug, label },
            select: { id: true },
          });
          await tx.articleTagLink.create({
            data: { articleId: stored.id, tagId: tag.id },
          });
        }
      });
    console.info(
      `[seed:articles] ${articles.length} artikel lengkap siap. Interaksi dan artikel lain dipertahankan.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    "[seed:articles] gagal:",
    error instanceof Error ? error.message : "Kesalahan tidak dikenal.",
  );
  process.exitCode = 1;
});
