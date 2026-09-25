import { z } from "zod";

export const ModerationStateFilterSchema = z.enum(["all", "live", "removed"]);

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

export type ModerationStateFilter = z.infer<typeof ModerationStateFilterSchema>;
export type ModerationQueryInput = z.infer<typeof ModerationQuerySchema>;
export type HideDiscussionRootInput = z.infer<typeof HideDiscussionRootSchema>;
export type TakedownCommentInput = z.infer<typeof TakedownCommentSchema>;
export type RestoreCommentInput = z.infer<typeof RestoreCommentSchema>;
