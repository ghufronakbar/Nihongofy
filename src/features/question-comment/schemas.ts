import { z } from "zod";
import {
  COMMENT_IMAGE_CONTENT_TYPE_LIST,
  COMMENT_IMAGE_MAX_COUNT,
  COMMENT_IMAGE_MAX_FILE_SIZE_BYTES,
} from "@/constants/storage";
import { CommentTargetSchema } from "./target";

// Bentuk URL divalidasi di sini; kepemilikan object (harus hasil upload user ini
// ke bucket kita, atau aset Cloudinary lama) dicek server lewat
// `isAllowedCommentImageUrl` karena butuh session dan env server.
const commentImagesSchema = z
  .array(z.url().max(2048, "URL gambar terlalu panjang."))
  .max(COMMENT_IMAGE_MAX_COUNT, `Maksimal ${COMMENT_IMAGE_MAX_COUNT} gambar.`);
const commentTextSchema = z
  .string()
  .trim()
  .min(1, "Komentar tidak boleh kosong.")
  .max(2000);

export const CommentVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

export const AddQuestionCommentSchema = z.object({
  target: CommentTargetSchema,
  commentText: commentTextSchema,
  commentImages: commentImagesSchema,
  // Wajib dikirim eksplisit, bukan default schema: `.default()` membuat tipe
  // input dan output zod berbeda sehingga zodResolver tidak lagi cocok dengan
  // react-hook-form. Form catatan mengirim "PRIVATE", form diskusi "PUBLIC".
  visibility: CommentVisibilitySchema,
});

export const EditQuestionCommentSchema = z.object({
  commentId: z.number().int().positive(),
  commentText: commentTextSchema,
  commentImages: commentImagesSchema,
});

export const DeleteQuestionCommentSchema = z.object({
  commentId: z.number().int().positive(),
});

// Balasan mewarisi target dan visibility dari root, jadi input hanya butuh
// parent. Balasan tidak punya toggle visibility sendiri.
export const ReplyQuestionCommentSchema = z.object({
  parentId: z.number().int().positive(),
  // Comment yang dituju balasan ini. Nullable dan wajib dikirim eksplisit —
  // `.default()` membuat tipe input dan output zod berbeda sehingga zodResolver
  // tidak lagi cocok dengan react-hook-form.
  repliedToId: z.number().int().positive().nullable(),
  commentText: commentTextSchema,
  commentImages: commentImagesSchema,
});

export const SetQuestionCommentVisibilitySchema = z.object({
  commentId: z.number().int().positive(),
  visibility: CommentVisibilitySchema,
});

export const GetDiscussionSchema = z.object({
  target: CommentTargetSchema,
});

// `voted` adalah keadaan yang diinginkan, bukan toggle: klik ganda atau retry
// tidak membalik suara dua kali.
export const VoteQuestionCommentSchema = z.object({
  commentId: z.number().int().positive(),
  voted: z.boolean(),
});

export const GetOwnVocabNotesSchema = z.object({
  vocabId: z.number().int().positive(),
});

export const CreateCommentImageUploadSchema = z.object({
  contentType: z.enum(COMMENT_IMAGE_CONTENT_TYPE_LIST, "Tipe gambar tidak didukung."),
  byteLength: z
    .number()
    .int()
    .positive()
    .max(COMMENT_IMAGE_MAX_FILE_SIZE_BYTES, "Ukuran gambar maksimal 5MB."),
});

export type CommentVisibilityInput = z.infer<typeof CommentVisibilitySchema>;
export type AddQuestionCommentInput = z.infer<typeof AddQuestionCommentSchema>;
export type EditQuestionCommentInput = z.infer<typeof EditQuestionCommentSchema>;
export type DeleteQuestionCommentInput = z.infer<typeof DeleteQuestionCommentSchema>;
export type ReplyQuestionCommentInput = z.infer<typeof ReplyQuestionCommentSchema>;
export type SetQuestionCommentVisibilityInput = z.infer<
  typeof SetQuestionCommentVisibilitySchema
>;
export type GetDiscussionInput = z.infer<typeof GetDiscussionSchema>;
export type GetOwnVocabNotesInput = z.infer<typeof GetOwnVocabNotesSchema>;
export type VoteQuestionCommentInput = z.infer<typeof VoteQuestionCommentSchema>;
export type CreateCommentImageUploadInput = z.infer<typeof CreateCommentImageUploadSchema>;
