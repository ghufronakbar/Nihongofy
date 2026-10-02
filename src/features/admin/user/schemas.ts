import { z } from "zod";

export const UserFilterSchema = z.enum([
  "all",
  "admin",
  "unverified",
  "oauth",
  "pendingDeletion",
  "postingSuspended",
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

// Alasan wajib: suspend tanpa alasan tidak dapat ditinjau ulang oleh admin lain.
// Pemilik akun dapat membacanya lewat export data akun.
export const SuspendUserPostingSchema = z.object({
  userId: z.number().int().positive(),
  reason: z
    .string()
    .trim()
    .min(5, "Tulis alasan minimal 5 karakter.")
    .max(500, "Alasan maksimal 500 karakter."),
});

export const LiftUserPostingSuspensionSchema = z.object({
  userId: z.number().int().positive(),
});

export type UserFilter = z.infer<typeof UserFilterSchema>;
export type SetUserRoleInput = z.infer<typeof SetUserRoleSchema>;
export type RevokeUserSessionInput = z.infer<typeof RevokeUserSessionSchema>;
export type ResetUserRateLimitInput = z.infer<typeof ResetUserRateLimitSchema>;
export type CancelUserDeletionInput = z.infer<typeof CancelUserDeletionSchema>;
export type SuspendUserPostingInput = z.infer<typeof SuspendUserPostingSchema>;
export type LiftUserPostingSuspensionInput = z.infer<typeof LiftUserPostingSuspensionSchema>;
