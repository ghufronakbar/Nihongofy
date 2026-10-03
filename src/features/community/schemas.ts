import { z } from "zod";
import { COMMENT_IMAGE_MAX_COUNT } from "@/constants/storage";

export const POST_TEXT_MAX_LENGTH = 2000;

// Teks polos. Baris baru dipertahankan (dirender `whitespace-pre-line`), tetapi
// karakter kontrol selain baris baru dan tab ditolak.
const postTextSchema = z
  .string()
  .trim()
  .min(1, "Postingan tidak boleh kosong.")
  .max(POST_TEXT_MAX_LENGTH, `Postingan maksimal ${POST_TEXT_MAX_LENGTH} karakter.`)
  .refine((value) => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value), "Postingan memuat karakter yang tidak valid.");

// Bentuk URL divalidasi di sini; kepemilikan object (hasil upload user ini)
// dicek server lewat `isAllowedCommentImageUrl`, sama seperti gambar komentar.
const postImagesSchema = z
  .array(z.url().max(2048, "URL gambar terlalu panjang."))
  .max(COMMENT_IMAGE_MAX_COUNT, `Maksimal ${COMMENT_IMAGE_MAX_COUNT} gambar.`);

const postIdSchema = z.number().int().positive();

export const CreatePostSchema = z.object({
  text: postTextSchema,
  images: postImagesSchema,
});

export const UpdatePostSchema = z.object({
  postId: postIdSchema,
  text: postTextSchema,
  images: postImagesSchema,
});

export const DeletePostSchema = z.object({ postId: postIdSchema });

// `liked` adalah keadaan yang diinginkan, bukan toggle.
export const LikePostSchema = z.object({
  postId: postIdSchema,
  liked: z.boolean(),
});

// `?before=<id postingan>` pada feed dan daftar postingan. Nilai tidak valid
// diperlakukan sebagai halaman pertama.
export const PostCursorSchema = z.coerce.number().int().positive().catch(0);

export const PostIdParamSchema = z.coerce.number().int().positive();

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type DeletePostInput = z.infer<typeof DeletePostSchema>;
export type LikePostInput = z.infer<typeof LikePostSchema>;
