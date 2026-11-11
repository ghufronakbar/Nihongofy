"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { CACHE_TAGS } from "@/constants/cache-key";
import { FEATURES } from "@/constants";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAdminActionTx } from "@/features/admin/audit";
import {
  ArticleCommentPinSchema,
  ArticleInteractionInputSchema,
  ArticleSlugSchema,
} from "./schemas";

const RecordViewSchema = z.object({ slug: ArticleSlugSchema });
function invalidate(slug: string) {
  updateTag(CACHE_TAGS.articleDetail(slug));
  updateTag(CACHE_TAGS.articleList);
}

export async function toggleArticleInteractionAction(input: unknown) {
  if (!FEATURES.article) return { ok: false as const, message: "Artikel sedang tidak tersedia." };
  const parsed = ArticleInteractionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Aksi artikel tidak valid." };
  const session = await getSession();
  if (!session)
    return {
      ok: false as const,
      requiresAuth: true,
      message: "Masuk untuk menyukai atau menyimpan artikel.",
    };
  const { slug, kind, value } = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    // Account lifecycle takes the same locks in this order. A concurrent
    // anonymization must finish before another interaction can be created.
    const users = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM "User" WHERE id = ${session.userId} AND "anonymizedAt" IS NULL FOR KEY SHARE`;
    const user = users[0];
    if (!user) return null;
    // Serialize state changes for this article, including first views. The unique
    // interaction key plus desired state prevents double-counting on retries.
    const rows = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM "Article" WHERE slug = ${slug} AND status = 'PUBLISHED' AND "publishedAt" <= NOW() FOR UPDATE`;
    const article = rows[0];
    if (!article) return null;
    const previous = await tx.articleInteraction.findUnique({
      where: { userId_articleId: { userId: user.id, articleId: article.id } },
      select: { saved: true, favorited: true },
    });
    await tx.articleInteraction.upsert({
      where: { userId_articleId: { userId: user.id, articleId: article.id } },
      create: { userId: user.id, articleId: article.id, [kind]: value },
      update: { [kind]: value },
    });
    const delta = Number(value) - Number(previous?.[kind] ?? false);
    if (kind === "favorited" && delta)
      await tx.article.update({
        where: { id: article.id },
        data: { favoriteCount: { increment: delta } },
      });
    const updated = await tx.article.findUniqueOrThrow({
      where: { id: article.id },
      select: { favoriteCount: true },
    });
    return { value, favoriteCount: updated.favoriteCount };
  });
  if (!result) return { ok: false as const, message: "Artikel atau akun tidak tersedia." };
  if (kind === "favorited") invalidate(slug);
  return { ok: true as const, ...result };
}

export async function recordArticleViewAction(input: unknown) {
  if (!FEATURES.article) return { ok: false as const };
  const parsed = RecordViewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const session = await getSession();
  if (!session) return { ok: true as const, recorded: false };
  const { slug } = parsed.data;
  const recorded = await prisma.$transaction(async (tx) => {
    const users = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM "User" WHERE id = ${session.userId} AND "anonymizedAt" IS NULL FOR KEY SHARE`;
    const user = users[0];
    if (!user) return false;
    const rows = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM "Article" WHERE slug = ${slug} AND status = 'PUBLISHED' AND "publishedAt" <= NOW() FOR UPDATE`;
    const article = rows[0];
    if (!article) return false;
    const previous = await tx.articleInteraction.findUnique({
      where: { userId_articleId: { userId: user.id, articleId: article.id } },
      select: { lastViewedAt: true },
    });
    await tx.articleInteraction.upsert({
      where: { userId_articleId: { userId: user.id, articleId: article.id } },
      create: {
        userId: user.id,
        articleId: article.id,
        lastViewedAt: new Date(),
      },
      update: { lastViewedAt: new Date() },
    });
    if (!previous?.lastViewedAt)
      await tx.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });
    return !previous?.lastViewedAt;
  });
  if (recorded) invalidate(slug);
  return { ok: true as const, recorded };
}

export async function pinArticleCommentAction(input: unknown) {
  const actor = await requireAdmin();
  if (!FEATURES.article) return { ok: false as const, message: "Artikel sedang tidak tersedia." };
  const parsed = ArticleCommentPinSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Aksi tidak valid." };
  const comment = await prisma.questionComment.findFirst({
    where: {
      id: parsed.data.commentId,
      articleId: { not: null },
      parentId: null,
      visibility: "PUBLIC",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!comment) return { ok: false as const, message: "Komentar tidak tersedia." };
  await prisma.$transaction(async (tx) => {
    await tx.questionComment.update({
      where: { id: comment.id },
      data: { isPinned: parsed.data.pinned },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "article.comment.pin",
      targetType: "comment",
      targetId: comment.id,
      summary: `Mengubah sematan komentar artikel #${comment.id}.`,
    });
  });
  return { ok: true as const };
}
