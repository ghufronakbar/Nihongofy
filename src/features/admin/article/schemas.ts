import { z } from "zod";
import { ArticleBodySchema, ArticleSlugSchema } from "@/features/article/schemas";

export const AdminArticleStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

// Body dikirim sebagai teks JSON dari textarea, bukan objek: form hanya punya
// string, dan pesan error parse perlu dibedakan dari error validasi blok supaya
// editor dapat memberi tahu mana yang salah.
const ArticleBodyTextSchema = z
  .string()
  .trim()
  .min(1, "Body tidak boleh kosong.")
  .superRefine((value, context) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      context.addIssue({ code: "custom", message: "Body bukan JSON yang valid." });
      return;
    }

    const result = ArticleBodySchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first.path.length > 0 ? ` (blok ${first.path.join(".")})` : "";
      context.addIssue({ code: "custom", message: `${first.message}${path}` });
    }
  });

const baseArticleFields = {
  slug: ArticleSlugSchema,
  title: z.string().trim().min(1, "Judul wajib diisi.").max(180),
  excerpt: z.string().trim().min(1, "Ringkasan wajib diisi.").max(400),
  bodyJson: ArticleBodyTextSchema,
  coverImage: z.string().trim().min(1, "Cover wajib diisi.").max(500),
  coverAlt: z.string().trim().min(1, "Teks alternatif cover wajib diisi.").max(240),
  authorName: z.string().trim().min(1, "Nama penulis wajib diisi.").max(120),
  authorRole: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1, "Kategori wajib diisi.").max(80),
  // Daftar label bebas; slug tag diturunkan server-side supaya tag yang sama
  // dengan ejaan berbeda tidak menghasilkan dua baris ArticleTag.
  //
  // Tanpa `.default([])` dan tanpa `z.coerce` di bawah: keduanya membuat tipe
  // input dan output zod berbeda sehingga zodResolver tidak lagi cocok dengan
  // react-hook-form. Form selalu mengirim array, dan input angka memakai
  // `valueAsNumber` di sisi form.
  tags: z.array(z.string().trim().min(1).max(80)).max(12),
  readTime: z.number().int().min(1, "Minimal 1 menit.").max(120),
  isFeatured: z.boolean(),
  status: AdminArticleStatusSchema,
};

export const CreateArticleSchema = z.object(baseArticleFields);

export const UpdateArticleSchema = z.object({
  id: z.number().int().positive(),
  ...baseArticleFields,
});

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
