import { z } from "zod";

const commentImagesSchema = z.array(z.string().url()).max(4, "Maksimal 4 gambar.");
const commentTextSchema = z
  .string()
  .trim()
  .min(1, "Komentar tidak boleh kosong.")
  .max(2000);

export const CommentVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

export const AddQuestionCommentSchema = z.object({
  questionId: z.number().int().positive(),
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

// Balasan mewarisi questionId dan visibility dari root, jadi input hanya butuh
// parent. Balasan tidak punya toggle visibility sendiri.
export const ReplyQuestionCommentSchema = z.object({
  parentId: z.number().int().positive(),
  commentText: commentTextSchema,
  commentImages: commentImagesSchema,
});

export const SetQuestionCommentVisibilitySchema = z.object({
  commentId: z.number().int().positive(),
  visibility: CommentVisibilitySchema,
});

export const GetQuestionDiscussionSchema = z.object({
  questionId: z.number().int().positive(),
});

export type CommentVisibilityInput = z.infer<typeof CommentVisibilitySchema>;
export type AddQuestionCommentInput = z.infer<typeof AddQuestionCommentSchema>;
export type EditQuestionCommentInput = z.infer<typeof EditQuestionCommentSchema>;
export type DeleteQuestionCommentInput = z.infer<typeof DeleteQuestionCommentSchema>;
export type ReplyQuestionCommentInput = z.infer<typeof ReplyQuestionCommentSchema>;
export type SetQuestionCommentVisibilityInput = z.infer<
  typeof SetQuestionCommentVisibilitySchema
>;
export type GetQuestionDiscussionInput = z.infer<typeof GetQuestionDiscussionSchema>;
