import { z } from "zod";

export const ModerationStateFilterSchema = z.enum(["all", "live", "removed"]);

// Antrean entri diskusi (termasuk komentar postingan) atau antrean postingan.
export const ModerationKindSchema = z.enum(["comments", "posts"]);

export const ModerationQuerySchema = z.object({
  state: ModerationStateFilterSchema,
  query: z.string().trim().max(200),
  userId: z.number().int().positive().optional(),
});

export const HideDiscussionRootSchema = z.object({
  commentId: z.number().int().positive(),
});

export const TakedownCommentSchema = z.object({
  commentId: z.number().int().positive(),
});

export const RestoreCommentSchema = z.object({
  commentId: z.number().int().positive(),
});

export const TakedownPostSchema = z.object({
  postId: z.number().int().positive(),
});

export const RestorePostSchema = z.object({
  postId: z.number().int().positive(),
});

export type ModerationStateFilter = z.infer<typeof ModerationStateFilterSchema>;
export type ModerationQueryInput = z.infer<typeof ModerationQuerySchema>;
export type HideDiscussionRootInput = z.infer<typeof HideDiscussionRootSchema>;
export type TakedownCommentInput = z.infer<typeof TakedownCommentSchema>;
export type RestoreCommentInput = z.infer<typeof RestoreCommentSchema>;
export type ModerationKind = z.infer<typeof ModerationKindSchema>;
export type TakedownPostInput = z.infer<typeof TakedownPostSchema>;
export type RestorePostInput = z.infer<typeof RestorePostSchema>;
