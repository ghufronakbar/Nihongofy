import { z } from "zod";

export const UserFilterSchema = z.enum([
  "all",
  "admin",
  "unverified",
  "oauth",
  "pendingDeletion",
]);

export const SetUserRoleSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(["USER", "ADMIN"]),
});

export const RevokeUserSessionSchema = z.object({
  userId: z.number().int().positive(),
  // Kosong berarti seluruh session user dicabut.
  sessionId: z.uuid().optional(),
});

export const ResetUserRateLimitSchema = z.object({
  userId: z.number().int().positive(),
});

export const CancelUserDeletionSchema = z.object({
  userId: z.number().int().positive(),
});

export type UserFilter = z.infer<typeof UserFilterSchema>;
export type SetUserRoleInput = z.infer<typeof SetUserRoleSchema>;
export type RevokeUserSessionInput = z.infer<typeof RevokeUserSessionSchema>;
export type ResetUserRateLimitInput = z.infer<typeof ResetUserRateLimitSchema>;
export type CancelUserDeletionInput = z.infer<typeof CancelUserDeletionSchema>;
