import { z } from "zod";

const articleText = z.string().trim().min(1).max(6_000);
const japanese = z.string().trim().max(6_000).optional();
const key = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .max(80)
  .optional();
export const ArticleImageSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) => /^\/(?!\/)[^\s]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value),
    "Gunakan path gambar lokal atau URL HTTPS.",
  );

export const ArticleBodyBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    key,
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().trim().min(1).max(180),
    japanese,
  }),
  z.object({ type: z.literal("paragraph"), key, text: articleText, japanese }),
  z.object({
    type: z.literal("list"),
    key,
    ordered: z.boolean().optional(),
    items: z.array(z.string().trim().min(1).max(800)).min(1).max(20),
    japaneseItems: z.array(z.string().trim().max(800)).max(20).optional(),
  }),
  z.object({
    type: z.literal("quote"),
    key,
    text: z.string().trim().min(1).max(1_000),
    japanese,
    attribution: z.string().trim().max(120).optional(),
  }),
  z.object({
    type: z.literal("example"),
    key,
    japanese: articleText,
    reading: z.string().trim().max(1_000).optional(),
    translation: articleText,
    note: z.string().trim().max(1_000).optional(),
  }),
  z.object({
    type: z.literal("callout"),
    key,
    title: z.string().trim().min(1).max(120),
    text: articleText,
    japanese,
    japaneseTitle: z.string().trim().max(180).optional(),
    tone: z.enum(["blue", "yellow", "green", "coral"]).optional(),
  }),
  z.object({
    type: z.literal("image"),
    key,
    src: ArticleImageSchema,
    alt: z.string().trim().min(1).max(240),
    caption: z.string().trim().max(500).optional(),
    japaneseCaption: z.string().trim().max(800).optional(),
  }),
]);

// Same discriminated shapes, allowing blank fields while an admin is typing.
export const ArticleEditorBodySchema = z
  .array(
    z.discriminatedUnion("type", [
      ArticleBodyBlockSchema.options[0].extend({ text: z.string() }),
      ArticleBodyBlockSchema.options[1].extend({ text: z.string() }),
      ArticleBodyBlockSchema.options[2].extend({ items: z.array(z.string()) }),
      ArticleBodyBlockSchema.options[3].extend({ text: z.string() }),
      ArticleBodyBlockSchema.options[4].extend({
        japanese: z.string(),
        translation: z.string(),
      }),
      ArticleBodyBlockSchema.options[5].extend({
        title: z.string(),
        text: z.string(),
      }),
      ArticleBodyBlockSchema.options[6].extend({
        src: z.string(),
        alt: z.string(),
      }),
    ]),
  )
  .max(120);

export const ArticleBodySchema = z
  .array(ArticleBodyBlockSchema)
  .min(1)
  .max(120)
  .superRefine((blocks, ctx) => {
    const keys = blocks.flatMap((block) => (block.key ? [block.key] : []));
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Identitas blok harus unik." });
  });
export const ArticleGlossarySchema = z
  .array(
    z.object({
      word: z.string().trim().min(1).max(160),
      meaning: z.string().trim().min(1).max(300),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .max(40);
export const ARTICLE_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export const ArticleLevelSchema = z.enum(ARTICLE_LEVELS);
export const ArticleSortSchema = z.enum(["newest", "oldest", "popular", "mostLiked"]);
export const ArticleSearchInputSchema = z.object({
  query: z.string().trim().max(120).default(""),
  category: z.string().trim().max(80).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  level: z.union([ArticleLevelSchema, z.literal(""), z.literal("general")]).default(""),
  language: z.enum(["", "id", "ja", "bilingual"]).default(""),
  sort: ArticleSortSchema.default("newest"),
  cursor: z.string().trim().max(300).optional(),
});
export const ArticleSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120)
  .refine(
    (value) => !["saved", "search", "read"].includes(value),
    "Slug ini dipakai oleh halaman artikel. Pilih slug lain.",
  );
// Desired state makes retries and repeated clicks idempotent.
export const ArticleInteractionInputSchema = z.object({
  slug: ArticleSlugSchema,
  kind: z.enum(["saved", "favorited"]),
  value: z.boolean(),
});
export const ArticleCommentPinSchema = z.object({
  commentId: z.number().int().positive(),
  pinned: z.boolean(),
});
export type ArticleBodyBlock = z.infer<typeof ArticleBodyBlockSchema>;
export type ArticleGlossary = z.infer<typeof ArticleGlossarySchema>;
export type ArticleSearchInput = z.infer<typeof ArticleSearchInputSchema>;
export type ArticleSort = z.infer<typeof ArticleSortSchema>;

export function blockHasJapanese(block: ArticleBodyBlock): boolean {
  if (block.type === "image") return !block.caption || Boolean(block.japaneseCaption?.trim());
  if (block.type === "list")
    return (
      block.japaneseItems?.length === block.items.length &&
      block.japaneseItems.every((item) => item.trim().length > 0)
    );
  if (block.type === "callout")
    return Boolean(block.japanese?.trim() && block.japaneseTitle?.trim());
  return Boolean(block.japanese?.trim());
}

// Examples can occur in an Indonesian article without making it bilingual.
// Any translation entered elsewhere must be complete before publishing.
export function blockHasJapaneseTranslation(block: ArticleBodyBlock): boolean {
  if (block.type === "example") return false;
  if (block.type === "image") return Boolean(block.japaneseCaption?.trim());
  if (block.type === "list") return Boolean(block.japaneseItems?.some((item) => item.trim()));
  if (block.type === "callout")
    return Boolean(block.japanese?.trim() || block.japaneseTitle?.trim());
  return Boolean(block.japanese?.trim());
}
