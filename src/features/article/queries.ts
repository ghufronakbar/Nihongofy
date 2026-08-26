import "server-only";

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ArticleBodySchema,
  ArticleSearchInputSchema,
  ArticleSortSchema,
  type ArticleSearchInput,
  type ArticleSort,
} from "./schemas";

const ARTICLE_PAGE_SIZE = 8;

const articleCardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  coverAlt: true,
  authorName: true,
  authorRole: true,
  category: true,
  categorySlug: true,
  isFeatured: true,
  publishedAt: true,
  readTime: true,
  viewCount: true,
  favoriteCount: true,
  updatedAt: true,
  tagLinks: {
    select: {
      tag: { select: { slug: true, label: true } },
    },
  },
} satisfies Prisma.ArticleSelect;

type ArticleCardRow = Prisma.ArticleGetPayload<{ select: typeof articleCardSelect }>;

export type ArticleCardData = Omit<ArticleCardRow, "tagLinks"> & {
  tags: Array<{ slug: string; label: string }>;
};

function normalizeArticleCard(row: ArticleCardRow): ArticleCardData {
  return {
    ...row,
    tags: row.tagLinks.map((link) => link.tag).sort((left, right) => left.label.localeCompare(right.label)),
  };
}

function reviveArticleCardDates(article: ArticleCardData): ArticleCardData {
  return {
    ...article,
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
    updatedAt: new Date(article.updatedAt),
  };
}

function publishedArticleWhere(now = new Date()): Prisma.ArticleWhereInput {
  return {
    status: "PUBLISHED",
    publishedAt: { lte: now },
  };
}

const getCachedArticleIndex = unstable_cache(
  async () => {
    const publishedWhere = publishedArticleWhere();
    const featured = await prisma.article.findFirst({
      where: { ...publishedWhere, isFeatured: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: articleCardSelect,
    });

    const latest = await prisma.article.findMany({
      where: {
        ...publishedWhere,
        ...(featured ? { id: { not: featured.id } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: 6,
      select: articleCardSelect,
    });

    return {
      featured: featured ? normalizeArticleCard(featured) : null,
      latest: latest.map(normalizeArticleCard),
    };
  },
  CACHE_KEYS.articleList,
  {
    tags: [CACHE_TAGS.articleList],
    revalidate: 3600,
  },
);

export async function getArticleIndexData() {
  const data = await getCachedArticleIndex();

  return {
    featured: data.featured ? reviveArticleCardDates(data.featured) : null,
    latest: data.latest.map(reviveArticleCardDates),
  };
}

const getCachedArticleFacets = unstable_cache(
  async () => {
    const publishedWhere = publishedArticleWhere();
    const [categories, tags] = await Promise.all([
      prisma.article.findMany({
        where: publishedWhere,
        distinct: ["categorySlug"],
        orderBy: { category: "asc" },
        select: { category: true, categorySlug: true },
      }),
      prisma.articleTag.findMany({
        where: { articleLinks: { some: { article: publishedWhere } } },
        orderBy: { label: "asc" },
        select: { slug: true, label: true },
      }),
    ]);

    return { categories, tags };
  },
  CACHE_KEYS.articleFacets,
  {
    tags: [CACHE_TAGS.articleFacets, CACHE_TAGS.articleList],
    revalidate: 3600,
  },
);

export async function getArticleFacets() {
  return getCachedArticleFacets();
}

const ArticleCursorSchema = z.object({
  sort: ArticleSortSchema,
  value: z.union([z.string().min(1).max(80), z.number().int().nonnegative()]),
  id: z.number().int().positive(),
});

type ArticleCursor = z.infer<typeof ArticleCursorSchema>;

function decodeCursor(value?: string): ArticleCursor | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const validated = ArticleCursorSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function encodeCursor(article: ArticleCardData, sort: ArticleSort) {
  const value =
    sort === "popular"
      ? article.viewCount
      : sort === "mostLiked"
        ? article.favoriteCount
        : article.publishedAt?.toISOString();

  if (value === undefined) return null;

  return Buffer.from(JSON.stringify({ sort, value, id: article.id }), "utf8").toString(
    "base64url",
  );
}

function cursorWhere(cursor: ArticleCursor | null, sort: ArticleSort): Prisma.ArticleWhereInput | null {
  if (!cursor || cursor.sort !== sort) return null;

  if (sort === "popular" && typeof cursor.value === "number") {
    return {
      OR: [
        { viewCount: { lt: cursor.value } },
        { viewCount: cursor.value, id: { lt: cursor.id } },
      ],
    };
  }

  if (sort === "mostLiked" && typeof cursor.value === "number") {
    return {
      OR: [
        { favoriteCount: { lt: cursor.value } },
        { favoriteCount: cursor.value, id: { lt: cursor.id } },
      ],
    };
  }

  if (typeof cursor.value !== "string") return null;
  const publishedAt = new Date(cursor.value);
  if (Number.isNaN(publishedAt.getTime())) return null;

  if (sort === "oldest") {
    return {
      OR: [
        { publishedAt: { gt: publishedAt } },
        { publishedAt, id: { gt: cursor.id } },
      ],
    };
  }

  return {
    OR: [
      { publishedAt: { lt: publishedAt } },
      { publishedAt, id: { lt: cursor.id } },
    ],
  };
}

function articleSearchWhere(
  input: ArticleSearchInput,
  includeCursor: boolean,
): Prisma.ArticleWhereInput {
  const and: Prisma.ArticleWhereInput[] = [];

  if (input.query) {
    and.push({
      OR: [
        { title: { contains: input.query, mode: "insensitive" } },
        { excerpt: { contains: input.query, mode: "insensitive" } },
        { bodyText: { contains: input.query, mode: "insensitive" } },
        { authorName: { contains: input.query, mode: "insensitive" } },
      ],
    });
  }

  for (const tag of input.tags) {
    and.push({ tagLinks: { some: { tag: { slug: tag } } } });
  }

  if (includeCursor) {
    const condition = cursorWhere(decodeCursor(input.cursor), input.sort);
    if (condition) and.push(condition);
  }

  return {
    ...publishedArticleWhere(),
    ...(input.category ? { categorySlug: input.category } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

function articleSearchOrder(sort: ArticleSort): Prisma.ArticleOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ publishedAt: "asc" }, { id: "asc" }];
    case "popular":
      return [{ viewCount: "desc" }, { id: "desc" }];
    case "mostLiked":
      return [{ favoriteCount: "desc" }, { id: "desc" }];
    case "newest":
    default:
      return [{ publishedAt: "desc" }, { id: "desc" }];
  }
}

const getCachedArticleSearch = unstable_cache(
  async (serializedInput: string) => {
    const input = ArticleSearchInputSchema.parse(JSON.parse(serializedInput));
    const [rows, total] = await Promise.all([
      prisma.article.findMany({
        where: articleSearchWhere(input, true),
        orderBy: articleSearchOrder(input.sort),
        take: ARTICLE_PAGE_SIZE + 1,
        select: articleCardSelect,
      }),
      prisma.article.count({ where: articleSearchWhere(input, false) }),
    ]);

    const hasMore = rows.length > ARTICLE_PAGE_SIZE;
    const articles = rows.slice(0, ARTICLE_PAGE_SIZE).map(normalizeArticleCard);
    const lastArticle = articles.at(-1);

    return {
      articles,
      total,
      nextCursor: hasMore && lastArticle ? encodeCursor(lastArticle, input.sort) : null,
    };
  },
  CACHE_KEYS.articleSearch,
  {
    tags: [CACHE_TAGS.articleList],
    revalidate: 1800,
  },
);

export async function searchArticles(input: ArticleSearchInput) {
  const validated = ArticleSearchInputSchema.parse(input);
  const results = await getCachedArticleSearch(JSON.stringify(validated));

  return {
    ...results,
    articles: results.articles.map(reviveArticleCardDates),
  };
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allSearchParams(value: string | string[] | undefined) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : value.split(",");
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function parseArticleSearchParams(params: Record<string, string | string[] | undefined>) {
  const candidate = {
    query: firstSearchParam(params.q) ?? "",
    category: firstSearchParam(params.category) ?? "",
    tags: allSearchParams(params.tags),
    sort: firstSearchParam(params.sort) ?? "newest",
    cursor: firstSearchParam(params.cursor),
  };
  const parsed = ArticleSearchInputSchema.safeParse(candidate);

  return parsed.success
    ? parsed.data
    : ArticleSearchInputSchema.parse({ query: "", category: "", tags: [], sort: "newest" });
}

export function buildArticleSearchHref(
  input: ArticleSearchInput,
  overrides: Partial<ArticleSearchInput> = {},
) {
  const nextInput = { ...input, ...overrides };
  const params = new URLSearchParams();

  if (nextInput.query) params.set("q", nextInput.query);
  if (nextInput.category) params.set("category", nextInput.category);
  for (const tag of nextInput.tags) params.append("tags", tag);
  if (nextInput.sort !== "newest") params.set("sort", nextInput.sort);
  if (nextInput.cursor) params.set("cursor", nextInput.cursor);

  const query = params.toString();
  return query ? `/article/search?${query}` : "/article/search";
}

const getCachedArticleDetail = (slug: string) =>
  unstable_cache(
    async (articleSlug: string) => {
      const article = await prisma.article.findFirst({
        where: { ...publishedArticleWhere(), slug: articleSlug },
        select: {
          ...articleCardSelect,
          body: true,
          bodyText: true,
        },
      });
      if (!article) return null;

      const body = ArticleBodySchema.safeParse(article.body);
      const relatedPrimary = await prisma.article.findMany({
        where: {
          ...publishedArticleWhere(),
          id: { not: article.id },
          categorySlug: article.categorySlug,
        },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: 3,
        select: articleCardSelect,
      });

      const relatedIds = relatedPrimary.map((item) => item.id);
      const relatedFallback =
        relatedPrimary.length < 3
          ? await prisma.article.findMany({
              where: {
                ...publishedArticleWhere(),
                id: { notIn: [article.id, ...relatedIds] },
              },
              orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
              take: 3 - relatedPrimary.length,
              select: articleCardSelect,
            })
          : [];

      const { tagLinks, ...articleData } = article;
      return {
        ...articleData,
        tags: tagLinks.map((link) => link.tag).sort((left, right) => left.label.localeCompare(right.label)),
        body: body.success ? body.data : null,
        related: [...relatedPrimary, ...relatedFallback].map(normalizeArticleCard),
      };
    },
    CACHE_KEYS.articleDetail(slug),
    {
      tags: [CACHE_TAGS.articleDetail(slug), CACHE_TAGS.articleList],
      revalidate: 3600,
    },
  )(slug);

export async function getArticleDetail(slug: string) {
  const article = await getCachedArticleDetail(slug);
  if (!article) return null;

  return {
    ...article,
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
    updatedAt: new Date(article.updatedAt),
    related: article.related.map(reviveArticleCardDates),
  };
}

export async function getArticleViewerState(articleId: number) {
  const session = await getSession();
  if (!session) {
    return { isAuthenticated: false as const, saved: false, favorited: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      articleInteractions: {
        where: { articleId },
        take: 1,
        select: { saved: true, favorited: true },
      },
    },
  });
  if (!user) {
    return { isAuthenticated: false as const, saved: false, favorited: false };
  }

  return {
    isAuthenticated: true as const,
    saved: user.articleInteractions[0]?.saved ?? false,
    favorited: user.articleInteractions[0]?.favorited ?? false,
  };
}

const getCachedArticleCoverData = (slug: string) =>
  unstable_cache(
    async (articleSlug: string) =>
      prisma.article.findFirst({
        where: { ...publishedArticleWhere(), slug: articleSlug },
        select: { slug: true, title: true, category: true, excerpt: true },
      }),
    CACHE_KEYS.articleCover(slug),
    { tags: [CACHE_TAGS.articleDetail(slug)], revalidate: 3600 },
  )(slug);

export async function getArticleCoverData(slug: string) {
  return getCachedArticleCoverData(slug);
}

const getCachedArticleSitemapEntries = unstable_cache(
  async () =>
    prisma.article.findMany({
      where: publishedArticleWhere(),
      orderBy: { publishedAt: "desc" },
      select: { slug: true, updatedAt: true },
    }),
  CACHE_KEYS.articleSitemap,
  { tags: [CACHE_TAGS.articleList], revalidate: 3600 },
);

export async function getArticleSitemapEntries() {
  const entries = await getCachedArticleSitemapEntries();
  return entries.map((entry) => ({ ...entry, updatedAt: new Date(entry.updatedAt) }));
}
