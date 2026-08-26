import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const articleFile = fileURLToPath(
  new URL("../src/features/article/data/article-seed.json", import.meta.url),
);

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function bodyToPlainText(blocks) {
  return blocks
    .flatMap((block) => {
      switch (block.type) {
        case "heading":
        case "paragraph":
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

async function main() {
  const articles = JSON.parse(await readFile(articleFile, "utf8"));
  const tagLabels = [...new Set(articles.flatMap((article) => article.tags))];

  for (const label of tagLabels) {
    await prisma.articleTag.upsert({
      where: { slug: slugify(label) },
      update: { label },
      create: { slug: slugify(label), label },
    });
  }

  const storedTags = await prisma.articleTag.findMany({
    where: { slug: { in: tagLabels.map(slugify) } },
    select: { id: true, slug: true },
  });
  const tagIdBySlug = new Map(storedTags.map((tag) => [tag.slug, tag.id]));

  for (const article of articles) {
    const storedArticle = await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,
        bodyText: bodyToPlainText(article.body),
        coverImage: article.coverImage,
        coverAlt: article.coverAlt,
        authorName: article.authorName,
        authorRole: article.authorRole,
        category: article.category,
        categorySlug: article.categorySlug,
        status: "PUBLISHED",
        isFeatured: article.isFeatured,
        publishedAt: new Date(article.publishedAt),
        readTime: article.readTime,
      },
      create: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,
        bodyText: bodyToPlainText(article.body),
        coverImage: article.coverImage,
        coverAlt: article.coverAlt,
        authorName: article.authorName,
        authorRole: article.authorRole,
        category: article.category,
        categorySlug: article.categorySlug,
        status: "PUBLISHED",
        isFeatured: article.isFeatured,
        publishedAt: new Date(article.publishedAt),
        readTime: article.readTime,
      },
      select: { id: true },
    });

    await prisma.articleTagLink.deleteMany({ where: { articleId: storedArticle.id } });
    await prisma.articleTagLink.createMany({
      data: article.tags.map((label) => ({
        articleId: storedArticle.id,
        tagId: tagIdBySlug.get(slugify(label)),
      })),
    });
  }

  console.info(
    `[seed:articles] ${articles.length} artikel dan ${tagLabels.length} tag siap.`,
  );
}

main()
  .catch((error) => {
    console.error("[seed:articles] gagal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
