"use server";

import { notFound } from "next/navigation";
import { updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { recordAdminActionTx } from "../audit";
import { CACHE_TAGS } from "@/constants/cache-key";
import { ArticleBodySchema, blockHasJapanese } from "@/features/article/schemas";
import { articleBodyToPlainText, slugifyArticleValue } from "@/features/article/lib/body-text";
import {
  CreateArticleSchema,
  UpdateArticleSchema,
  SetArticleStatusSchema,
  SetArticleFeaturedSchema,
  DeleteArticleSchema,
  type CreateArticleInput,
} from "./schemas";

export type AdminArticleActionResult = { ok: true; id: number } | { ok: false; message: string };
function revalidateArticle(slugs: string[]) {
  updateTag(CACHE_TAGS.articleList);
  updateTag(CACHE_TAGS.articleFacets);
  for (const slug of slugs) updateTag(CACHE_TAGS.articleDetail(slug));
}
async function syncTags(tx: Prisma.TransactionClient, articleId: number, labels: string[]) {
  const unique = new Map(labels.map((label) => [slugifyArticleValue(label), label]));
  await tx.articleTagLink.deleteMany({ where: { articleId } });
  for (const [slug, label] of unique) {
    const tag = await tx.articleTag.upsert({
      where: { slug },
      update: { label },
      create: { slug, label },
      select: { id: true },
    });
    await tx.articleTagLink.create({ data: { articleId, tagId: tag.id } });
  }
}
function contentFields(data: CreateArticleInput) {
  const body = ArticleBodySchema.parse(JSON.parse(data.bodyJson));
  return {
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    titleJa: data.titleJa || null,
    excerptJa: data.excerptJa || null,
    readingLevel: data.readingLevel || null,
    hasJapanese: Boolean(
      data.titleJa && data.excerptJa && data.readingLevel && body.every(blockHasJapanese),
    ),
    body,
    bodyText: articleBodyToPlainText(body),
    glossary: data.glossary,
    coverImage: data.coverImage,
    coverAlt: data.coverAlt,
    coverCredit: data.coverCredit || null,
    coverCreditUrl: data.coverCreditUrl || null,
    authorName: data.authorName,
    authorRole: data.authorRole || null,
    category: data.category,
    categorySlug: slugifyArticleValue(data.category),
    readTime: data.readTime,
    isFeatured: data.isFeatured,
    discussionEnabled: data.discussionEnabled,
    status: data.status,
  };
}
function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createArticleAction(input: unknown): Promise<AdminArticleActionResult> {
  const actor = await requireAdmin();
  const parsed = CreateArticleSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  const data = parsed.data;
  try {
    const article = await prisma.$transaction(async (tx) => {
      const row = await tx.article.create({
        data: {
          ...contentFields(data),
          publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        },
        select: { id: true },
      });
      await syncTags(tx, row.id, data.tags);
      await recordAdminActionTx(tx, {
        actor,
        action: "article.create",
        targetType: "article",
        targetId: row.id,
        summary: `Membuat artikel ${data.slug} (${data.status}).`,
      });
      return row;
    });
    revalidateArticle([data.slug]);
    return { ok: true, id: article.id };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false, message: "Slug sudah dipakai artikel lain." };
    throw error;
  }
}

export async function updateArticleAction(input: unknown): Promise<AdminArticleActionResult> {
  const actor = await requireAdmin();
  const parsed = UpdateArticleSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  const { id, ...data } = parsed.data;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.article.findUnique({
        where: { id },
        select: { slug: true, status: true, publishedAt: true },
      });
      if (!current) notFound();
      if (current.publishedAt && current.slug !== data.slug)
        return {
          ok: false as const,
          message:
            "Slug artikel yang pernah terbit tidak dapat diubah agar tautan pembaca tetap berlaku.",
        };
      const savePrivateDraft = current.status === "PUBLISHED" && data.status === "DRAFT";
      await tx.article.update({
        where: { id },
        data: savePrivateDraft
          ? { draft: data }
          : {
              ...contentFields(data),
              draft: Prisma.DbNull,
              publishedAt:
                data.status === "PUBLISHED"
                  ? (current.publishedAt ?? new Date())
                  : current.publishedAt,
            },
      });
      if (!savePrivateDraft) await syncTags(tx, id, data.tags);
      await recordAdminActionTx(tx, {
        actor,
        action: savePrivateDraft ? "article.draft" : "article.update",
        targetType: "article",
        targetId: id,
        summary: `${savePrivateDraft ? "Menyimpan draf privat" : "Menyunting artikel"} ${data.slug}.`,
      });
      return { ok: true as const, slug: current.slug };
    });
    if (!result.ok) return result;
    revalidateArticle([result.slug, data.slug]);
    return { ok: true, id };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false, message: "Slug sudah dipakai artikel lain." };
    throw error;
  }
}

export async function setArticleStatusAction(input: unknown) {
  const actor = await requireAdmin();
  const parsed = SetArticleStatusSchema.safeParse(input);
  if (!parsed.success) notFound();
  const { id, status } = parsed.data;
  // Publishing always goes through the validated editor, including bilingual checks.
  if (status === "PUBLISHED")
    return {
      ok: false as const,
      message: "Buka editor dan gunakan tombol Terbitkan.",
    };
  const current = await prisma.article.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!current) notFound();
  await prisma.$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: { status } });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.status",
      targetType: "article",
      targetId: id,
      summary: `Mengubah ${current.slug} menjadi ${status}.`,
    });
  });
  revalidateArticle([current.slug]);
  return { ok: true as const };
}
export async function setArticleFeaturedAction(input: unknown) {
  const actor = await requireAdmin();
  const parsed = SetArticleFeaturedSchema.safeParse(input);
  if (!parsed.success) notFound();
  const current = await prisma.article.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true },
  });
  if (!current) notFound();
  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: parsed.data.id },
      data: { isFeatured: parsed.data.isFeatured },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.featured",
      targetType: "article",
      targetId: parsed.data.id,
      summary: `Mengubah pilihan redaksi ${current.slug}.`,
    });
  });
  revalidateArticle([current.slug]);
  return { ok: true as const };
}
export async function deleteArticleAction(input: unknown) {
  const actor = await requireAdmin();
  const parsed = DeleteArticleSchema.safeParse(input);
  if (!parsed.success) notFound();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${parsed.data.id} FOR UPDATE`;
    const current = await tx.article.findUnique({
      where: { id: parsed.data.id },
      select: {
        slug: true,
        publishedAt: true,
        _count: { select: { comments: true } },
      },
    });
    if (!current) notFound();
    if (current.publishedAt || current._count.comments)
      return {
        ok: false as const,
        message: "Artikel yang pernah terbit atau memiliki diskusi harus diarsipkan.",
      };
    await tx.article.delete({ where: { id: parsed.data.id } });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.delete",
      targetType: "article",
      targetId: parsed.data.id,
      summary: `Menghapus draf ${current.slug}.`,
    });
    return { ok: true as const, slug: current.slug };
  });
  if (!result.ok) return result;
  revalidateArticle([result.slug]);
  return { ok: true as const };
}
