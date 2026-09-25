import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ArticleBodySchema } from "@/features/article/schemas";
import type { AdminArticleStatus } from "./schemas";

// Tidak di-cache: layar admin dibuka justru untuk melihat kondisi terkini,
// termasuk tepat setelah publish atau arsip. Cache publik tetap di-invalidasi
// oleh action-nya lewat CACHE_TAGS.

const adminArticleListSelect = {
  id: true,
  slug: true,
  title: true,
  category: true,
  status: true,
  isFeatured: true,
  publishedAt: true,
  updatedAt: true,
  viewCount: true,
  favoriteCount: true,
  tagLinks: { select: { tag: { select: { slug: true, label: true } } } },
} satisfies Prisma.ArticleSelect;

export type AdminArticleListItem = Omit<
  Prisma.ArticleGetPayload<{ select: typeof adminArticleListSelect }>,
  "tagLinks"
> & { tags: string[] };

export async function listAdminArticles(filter: {
  status?: AdminArticleStatus;
  query?: string;
}) {
  const where: Prisma.ArticleWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.query) {
    where.OR = [
      { title: { contains: filter.query, mode: "insensitive" } },
      { slug: { contains: filter.query, mode: "insensitive" } },
      { category: { contains: filter.query, mode: "insensitive" } },
    ];
  }

  const [rows, counts] = await Promise.all([
    prisma.article.findMany({
      where,
      // Draft yang baru disentuh harus muncul di atas artikel lama yang sudah
      // terbit, jadi urutannya memakai updatedAt, bukan publishedAt.
      orderBy: { updatedAt: "desc" },
      select: adminArticleListSelect,
    }),
    prisma.article.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const items: AdminArticleListItem[] = rows.map(({ tagLinks, ...row }) => ({
    ...row,
    tags: tagLinks.map((link) => link.tag.label),
  }));

  const countFor = (status: AdminArticleStatus) =>
    counts.find((row) => row.status === status)?._count._all ?? 0;

  return {
    items,
    counts: {
      total: counts.reduce((sum, row) => sum + row._count._all, 0),
      draft: countFor("DRAFT"),
      published: countFor("PUBLISHED"),
      archived: countFor("ARCHIVED"),
    },
  };
}

export type AdminArticleDetail = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  bodyJson: string;
  coverImage: string;
  coverAlt: string;
  authorName: string;
  authorRole: string;
  category: string;
  tags: string[];
  readTime: number;
  isFeatured: boolean;
  status: AdminArticleStatus;
  publishedAt: Date | null;
  viewCount: number;
  favoriteCount: number;
};

export async function getAdminArticle(id: number): Promise<AdminArticleDetail | null> {
  const row = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      coverImage: true,
      coverAlt: true,
      authorName: true,
      authorRole: true,
      category: true,
      readTime: true,
      isFeatured: true,
      status: true,
      publishedAt: true,
      viewCount: true,
      favoriteCount: true,
      tagLinks: { select: { tag: { select: { label: true } } } },
    },
  });

  if (!row) return null;

  // Body lama berasal dari fixture dan belum tentu lolos schema saat ini.
  // Editor tetap harus bisa membukanya untuk diperbaiki, jadi isi mentahnya
  // ditampilkan apa adanya ketika parse gagal alih-alih menolak membuka halaman.
  const parsed = ArticleBodySchema.safeParse(row.body);
  const bodyJson = JSON.stringify(parsed.success ? parsed.data : row.body, null, 2);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyJson,
    coverImage: row.coverImage,
    coverAlt: row.coverAlt,
    authorName: row.authorName,
    authorRole: row.authorRole ?? "",
    category: row.category,
    tags: row.tagLinks.map((link) => link.tag.label),
    readTime: row.readTime,
    isFeatured: row.isFeatured,
    status: row.status,
    publishedAt: row.publishedAt,
    viewCount: row.viewCount,
    favoriteCount: row.favoriteCount,
  };
}

export async function listArticleTagLabels() {
  const tags = await prisma.articleTag.findMany({
    orderBy: { label: "asc" },
    select: { label: true },
  });
  return tags.map((tag) => tag.label);
}
