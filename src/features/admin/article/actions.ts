"use server";

import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { recordAdminActionTx } from "../audit";
import { CACHE_TAGS } from "@/constants/cache-key";
import { ArticleBodySchema } from "@/features/article/schemas";
import {
  articleBodyToPlainText,
  slugifyArticleValue,
} from "@/features/article/lib/body-text";
import {
  CreateArticleSchema,
  UpdateArticleSchema,
  SetArticleStatusSchema,
  SetArticleFeaturedSchema,
  DeleteArticleSchema,
  type CreateArticleInput,
  type UpdateArticleInput,
  type SetArticleStatusInput,
  type SetArticleFeaturedInput,
  type DeleteArticleInput,
} from "./schemas";

export type AdminArticleActionResult =
  | { ok: true }
  | { ok: false; message: string; field?: "slug" | "bodyJson" };

// Mengubah satu artikel dapat mengubah listing, facet kategori/tag, halaman
// detail, cover, dan sitemap sekaligus. Seluruh query publik itu hanya memakai
// tiga tag di bawah, jadi ketiganya selalu dipanggil bersama-sama daripada
// dipilih-pilih per kasus dan berisiko menyisakan halaman basi.
function revalidateArticle(slugs: string[]) {
  updateTag(CACHE_TAGS.articleList);
  updateTag(CACHE_TAGS.articleFacets);
  for (const slug of new Set(slugs)) {
    updateTag(CACHE_TAGS.articleDetail(slug));
  }
}

// Label bebas dari form dipetakan ke slug stabil supaya "Tata Bahasa" dan
// "tata bahasa" tidak menjadi dua ArticleTag yang berbeda.
async function syncArticleTags(
  tx: Prisma.TransactionClient,
  articleId: number,
  labels: string[],
) {
  const bySlug = new Map<string, string>();
  for (const label of labels) {
    const slug = slugifyArticleValue(label);
    if (slug) bySlug.set(slug, label);
  }

  await tx.articleTagLink.deleteMany({ where: { articleId } });
  if (bySlug.size === 0) return;

  const tagIds: number[] = [];
  for (const [slug, label] of bySlug) {
    const tag = await tx.articleTag.upsert({
      where: { slug },
      update: { label },
      create: { slug, label },
      select: { id: true },
    });
    tagIds.push(tag.id);
  }

  await tx.articleTagLink.createMany({
    data: tagIds.map((tagId) => ({ articleId, tagId })),
  });
}

// `body` sudah divalidasi ArticleBodySchema oleh schema form; parse ulang di
// sini hanya untuk mendapatkan objek bertipe, bukan string.
function buildContentFields(input: { bodyJson: string }) {
  const body = ArticleBodySchema.parse(JSON.parse(input.bodyJson));
  return { body, bodyText: articleBodyToPlainText(body) };
}

export async function createArticleAction(
  input: CreateArticleInput,
): Promise<AdminArticleActionResult> {
  const actor = await requireAdmin();

  const validated = CreateArticleSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const existing = await prisma.article.findUnique({
    where: { slug: data.slug },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "Slug sudah dipakai artikel lain.", field: "slug" };
  }

  const { body, bodyText } = buildContentFields(data);

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        body,
        bodyText,
        coverImage: data.coverImage,
        coverAlt: data.coverAlt,
        authorName: data.authorName,
        authorRole: data.authorRole || null,
        category: data.category,
        categorySlug: slugifyArticleValue(data.category),
        status: data.status,
        isFeatured: data.isFeatured,
        // publishedAt hanya terisi saat artikel benar-benar terbit; draft yang
        // belum pernah publish tidak boleh punya tanggal terbit.
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        readTime: data.readTime,
      },
      select: { id: true },
    });
    await syncArticleTags(tx, article.id, data.tags);
    await recordAdminActionTx(tx, {
      actor,
      action: "article.create",
      targetType: "article",
      targetId: article.id,
      summary: `Membuat artikel "${data.title}" (${data.slug}) berstatus ${data.status}.`,
    });
  });

  revalidateArticle([data.slug]);
  redirect("/admin/article");
}

export async function updateArticleAction(
  input: UpdateArticleInput,
): Promise<AdminArticleActionResult> {
  const actor = await requireAdmin();

  const validated = UpdateArticleSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const current = await prisma.article.findUnique({
    where: { id: data.id },
    select: { slug: true, status: true, publishedAt: true },
  });
  if (!current) notFound();

  if (data.slug !== current.slug) {
    const clash = await prisma.article.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    });
    if (clash) {
      return { ok: false, message: "Slug sudah dipakai artikel lain.", field: "slug" };
    }
  }

  const { body, bodyText } = buildContentFields(data);

  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: data.id },
      data: {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        body,
        bodyText,
        coverImage: data.coverImage,
        coverAlt: data.coverAlt,
        authorName: data.authorName,
        authorRole: data.authorRole || null,
        category: data.category,
        categorySlug: slugifyArticleValue(data.category),
        status: data.status,
        isFeatured: data.isFeatured,
        // Tanggal terbit pertama dipertahankan. Menerbitkan ulang artikel yang
        // pernah diarsipkan tidak boleh mengubah urutan kronologis listing.
        publishedAt:
          data.status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
        readTime: data.readTime,
      },
    });
    await syncArticleTags(tx, data.id, data.tags);
    await recordAdminActionTx(tx, {
      actor,
      action: "article.update",
      targetType: "article",
      targetId: data.id,
      summary:
        `Menyunting artikel "${data.title}" (status ${data.status})` +
        (data.slug !== current.slug ? `, slug ${current.slug} -> ${data.slug}.` : "."),
    });
  });

  // Slug lama ikut diinvalidasi supaya halaman detail di URL lama tidak
  // menyajikan artikel yang sudah pindah alamat.
  revalidateArticle([current.slug, data.slug]);
  redirect("/admin/article");
}

export async function setArticleStatusAction(input: SetArticleStatusInput) {
  const actor = await requireAdmin();

  const validated = SetArticleStatusSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const { id, status } = validated.data;
  const current = await prisma.article.findUnique({
    where: { id },
    select: { slug: true, publishedAt: true },
  });
  if (!current) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id },
      data: {
        status,
        publishedAt:
          status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
      },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.status",
      targetType: "article",
      targetId: id,
      summary: `Mengubah status artikel ${current.slug} menjadi ${status}.`,
    });
  });

  revalidateArticle([current.slug]);
}

export async function setArticleFeaturedAction(input: SetArticleFeaturedInput) {
  const actor = await requireAdmin();

  const validated = SetArticleFeaturedSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const { id, isFeatured } = validated.data;
  const current = await prisma.article.findUnique({ where: { id }, select: { slug: true } });
  if (!current) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: { isFeatured } });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.featured",
      targetType: "article",
      targetId: id,
      summary: `${isFeatured ? "Menandai" : "Melepas"} artikel ${current.slug} sebagai featured.`,
    });
  });
  revalidateArticle([current.slug]);
}

// Hard delete, berbeda dengan takedown komentar. Artikel adalah konten editorial
// milik tim, bukan tulisan user, dan tidak ada balasan orang lain yang menempel
// padanya. Interaction user (saved/favorited) ikut terhapus lewat cascade —
// karena itu mengarsipkan lebih disarankan daripada menghapus.
export async function deleteArticleAction(input: DeleteArticleInput) {
  const actor = await requireAdmin();

  const validated = DeleteArticleSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const current = await prisma.article.findUnique({
    where: { id: validated.data.id },
    select: { slug: true },
  });
  if (!current) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.article.delete({ where: { id: validated.data.id } });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.delete",
      targetType: "article",
      targetId: validated.data.id,
      summary: `Menghapus permanen artikel ${current.slug} beserta interaksi user-nya.`,
    });
  });
  revalidateArticle([current.slug]);
}
