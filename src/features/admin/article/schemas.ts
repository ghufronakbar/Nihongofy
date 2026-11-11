import { z } from "zod";
import {
  ArticleBodySchema,
  ArticleGlossarySchema,
  ArticleImageSchema,
  ArticleLevelSchema,
  ArticleSlugSchema,
  blockHasJapanese,
  blockHasJapaneseTranslation,
} from "@/features/article/schemas";

export const AdminArticleStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const bodyJson = z
  .string()
  .trim()
  .min(1, "Tambahkan isi artikel.")
  .max(1_000_000)
  .superRefine((value, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Isi artikel tidak valid." });
      return;
    }
    const result = ArticleBodySchema.safeParse(parsed);
    if (!result.success)
      ctx.addIssue({
        code: "custom",
        message: result.error.issues[0]?.message ?? "Periksa isi artikel.",
      });
  });
const fields = {
  slug: ArticleSlugSchema,
  title: z.string().trim().min(1, "Judul wajib diisi.").max(180),
  excerpt: z.string().trim().min(1, "Ringkasan wajib diisi.").max(500),
  titleJa: z.string().trim().max(240),
  excerptJa: z.string().trim().max(1_000),
  readingLevel: z.union([ArticleLevelSchema, z.literal("")]),
  bodyJson,
  glossary: ArticleGlossarySchema,
  coverImage: ArticleImageSchema,
  coverAlt: z.string().trim().min(1, "Teks alternatif wajib diisi.").max(240),
  coverCredit: z.string().trim().max(240),
  coverCreditUrl: z.union([z.url().startsWith("https://").max(2_048), z.literal("")]),
  authorName: z.string().trim().min(1, "Nama penulis wajib diisi.").max(120),
  authorRole: z.string().trim().max(120),
  category: z
    .string()
    .trim()
    .min(1, "Kategori wajib diisi.")
    .max(80)
    .refine((value) => /[a-zA-Z0-9]/.test(value), "Gunakan nama kategori berbahasa Indonesia."),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(80)
        .refine((value) => /[a-zA-Z0-9]/.test(value), "Gunakan tag berbahasa Indonesia."),
    )
    .max(12),
  readTime: z.number().int().min(1).max(120),
  isFeatured: z.boolean(),
  discussionEnabled: z.boolean(),
  status: AdminArticleStatusSchema,
};
function publishChecks(data: z.infer<z.ZodObject<typeof fields>>, ctx: z.RefinementCtx) {
  if (data.status !== "PUBLISHED") return;
  let body: unknown;
  try {
    body = JSON.parse(data.bodyJson);
  } catch {
    return;
  }
  const parsed = ArticleBodySchema.safeParse(body);
  if (!parsed.success) return;
  const wantsJapanese = Boolean(
    data.titleJa || data.excerptJa || parsed.data.some(blockHasJapaneseTranslation),
  );
  if (wantsJapanese) {
    if (!data.titleJa)
      ctx.addIssue({
        code: "custom",
        path: ["titleJa"],
        message: "Lengkapi judul Jepang sebelum terbit.",
      });
    if (!data.excerptJa)
      ctx.addIssue({
        code: "custom",
        path: ["excerptJa"],
        message: "Lengkapi ringkasan Jepang sebelum terbit.",
      });
    if (!data.readingLevel)
      ctx.addIssue({
        code: "custom",
        path: ["readingLevel"],
        message: "Tentukan perkiraan level bacaan Jepang.",
      });
    if (!parsed.data.every(blockHasJapanese))
      ctx.addIssue({
        code: "custom",
        path: ["bodyJson"],
        message: "Lengkapi pasangan bahasa Jepang di setiap blok, atau simpan sebagai draf.",
      });
  } else if (data.readingLevel)
    ctx.addIssue({
      code: "custom",
      path: ["readingLevel"],
      message: "Level bacaan memerlukan versi Jepang yang lengkap.",
    });
}
export const CreateArticleSchema = z.object(fields).superRefine(publishChecks);
export const UpdateArticleSchema = z
  .object({ id: z.number().int().positive(), ...fields })
  .superRefine(publishChecks);
export const SetArticleStatusSchema = z.object({
  id: z.number().int().positive(),
  status: AdminArticleStatusSchema,
});
export const SetArticleFeaturedSchema = z.object({
  id: z.number().int().positive(),
  isFeatured: z.boolean(),
});
export const DeleteArticleSchema = z.object({
  id: z.number().int().positive(),
});
export type AdminArticleStatus = z.infer<typeof AdminArticleStatusSchema>;
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;
export type SetArticleStatusInput = z.infer<typeof SetArticleStatusSchema>;
export type SetArticleFeaturedInput = z.infer<typeof SetArticleFeaturedSchema>;
export type DeleteArticleInput = z.infer<typeof DeleteArticleSchema>;
