import { z } from "zod";

const articleText = z.string().trim().min(1).max(4_000);

export const ArticleBodyBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().trim().min(1).max(160),
  }),
  z.object({
    type: z.literal("paragraph"),
    text: articleText,
  }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean().default(false),
    items: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  }),
  z.object({
    type: z.literal("quote"),
    text: z.string().trim().min(1).max(700),
    attribution: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({
    type: z.literal("example"),
    japanese: z.string().trim().min(1).max(500),
    reading: z.string().trim().min(1).max(500).optional(),
    translation: z.string().trim().min(1).max(700),
    note: z.string().trim().min(1).max(700).optional(),
  }),
  z.object({
    type: z.literal("callout"),
    title: z.string().trim().min(1).max(120),
    text: z.string().trim().min(1).max(900),
    tone: z.enum(["blue", "yellow", "green", "coral"]).default("yellow"),
  }),
]);

export const ArticleBodySchema = z.array(ArticleBodyBlockSchema).min(1).max(80);

export const ArticleSortSchema = z.enum(["newest", "oldest", "popular", "mostLiked"]);
export type ArticleSort = z.infer<typeof ArticleSortSchema>;

export const ArticleSearchInputSchema = z.object({
  query: z.string().trim().max(120).default(""),
  category: z.string().trim().max(80).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  sort: ArticleSortSchema.default("newest"),
  cursor: z.string().trim().max(300).optional(),
});

export const ArticleSlugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);

export const ArticleInteractionInputSchema = z.object({
  slug: ArticleSlugSchema,
  kind: z.enum(["saved", "favorited"]),
});

export type ArticleBodyBlock = z.infer<typeof ArticleBodyBlockSchema>;
export type ArticleSearchInput = z.infer<typeof ArticleSearchInputSchema>;
