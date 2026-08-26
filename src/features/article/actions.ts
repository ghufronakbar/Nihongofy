"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { CACHE_TAGS } from "@/constants/cache-key";
import { destroySession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArticleInteractionInputSchema, ArticleSlugSchema } from "./schemas";

const RecordArticleViewSchema = z.object({ slug: ArticleSlugSchema });

export async function toggleArticleInteractionAction(input: unknown) {
  const validated = ArticleInteractionInputSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false as const, message: "Aksi artikel tidak valid." };
  }

  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      requiresAuth: true as const,
      message: "Masuk untuk menyimpan artikel ke akunmu.",
    };
  }

  const { slug, kind } = validated.data;
  const result = await prisma.$transaction(
    async (tx) => {
      const [user, article] = await Promise.all([
        tx.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
        tx.article.findFirst({
          where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
          select: { id: true },
        }),
      ]);

      if (!user) return { kind: "invalid-session" as const };
      if (!article) return { kind: "missing-article" as const };

      const existing = await tx.articleInteraction.findUnique({
        where: { userId_articleId: { userId: user.id, articleId: article.id } },
        select: { saved: true, favorited: true },
      });
      const previousValue = existing?.[kind] ?? false;
      const nextValue = !previousValue;

      await tx.articleInteraction.upsert({
        where: { userId_articleId: { userId: user.id, articleId: article.id } },
        create: {
          userId: user.id,
          articleId: article.id,
          saved: kind === "saved" ? nextValue : false,
          favorited: kind === "favorited" ? nextValue : false,
        },
        update: kind === "saved" ? { saved: nextValue } : { favorited: nextValue },
      });

      if (kind === "favorited") {
        if (nextValue) {
          await tx.article.update({
            where: { id: article.id },
            data: { favoriteCount: { increment: 1 } },
          });
        } else {
          await tx.article.updateMany({
            where: { id: article.id, favoriteCount: { gt: 0 } },
            data: { favoriteCount: { decrement: 1 } },
          });
        }
      }

      const updatedArticle = await tx.article.findUnique({
        where: { id: article.id },
        select: { favoriteCount: true },
      });

      return {
        kind: "updated" as const,
        value: nextValue,
        favoriteCount: updatedArticle?.favoriteCount ?? 0,
      };
    },
    { isolationLevel: "Serializable" },
  );

  if (result.kind === "invalid-session") {
    await destroySession();
    return {
      ok: false as const,
      requiresAuth: true as const,
      message: "Sesi akun sudah tidak berlaku. Masuk lagi untuk melanjutkan.",
    };
  }

  if (result.kind === "missing-article") {
    return { ok: false as const, message: "Artikel tidak tersedia." };
  }

  if (kind === "favorited") {
    updateTag(CACHE_TAGS.articleDetail(slug));
    updateTag(CACHE_TAGS.articleList);
  }

  return { ok: true as const, ...result };
}

export async function recordArticleViewAction(input: unknown) {
  const validated = RecordArticleViewSchema.safeParse(input);
  if (!validated.success) return { ok: false as const };

  const session = await getSession();
  if (!session) return { ok: true as const, recorded: false as const };

  const { slug } = validated.data;
  const result = await prisma.$transaction(
    async (tx) => {
      const [user, article] = await Promise.all([
        tx.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
        tx.article.findFirst({
          where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
          select: { id: true },
        }),
      ]);
      if (!user || !article) return null;

      const existing = await tx.articleInteraction.findUnique({
        where: { userId_articleId: { userId: user.id, articleId: article.id } },
        select: { lastViewedAt: true },
      });
      const isFirstView = !existing?.lastViewedAt;

      await tx.articleInteraction.upsert({
        where: { userId_articleId: { userId: user.id, articleId: article.id } },
        create: { userId: user.id, articleId: article.id, lastViewedAt: new Date() },
        update: { lastViewedAt: new Date() },
      });

      if (isFirstView) {
        await tx.article.update({
          where: { id: article.id },
          data: { viewCount: { increment: 1 } },
        });
      }

      return { isFirstView };
    },
    { isolationLevel: "Serializable" },
  );

  if (result?.isFirstView) {
    updateTag(CACHE_TAGS.articleDetail(slug));
    updateTag(CACHE_TAGS.articleList);
  }

  return { ok: Boolean(result) as boolean, recorded: Boolean(result) };
}
