import { z } from "zod";
import { USERNAME_MAX_LENGTH } from "@/lib/username";

export const ProfileVisibilitySchema = z.object({
  profileVisibility: z.enum(["PUBLIC", "PRIVATE"]),
});

export type ProfileVisibilityInput = z.infer<typeof ProfileVisibilitySchema>;

// Param `/u/[username]`. Sengaja lebih longgar dari `UsernameSchema`: handle
// lama yang lahir sebelum aturan sekarang (atau kebetulan kini masuk daftar
// terlarang) tetap harus bisa dibuka. Yang dijaga hanya bentuk dan panjangnya,
// sebelum menyentuh database.
export const UsernameParamSchema = z
  .string()
  .min(1)
  .max(USERNAME_MAX_LENGTH)
  .regex(/^[A-Za-z0-9._]+$/);

export const SetFollowSchema = z.object({
  username: UsernameParamSchema.transform((value) => value.toLowerCase()),
  following: z.boolean(),
});

export type SetFollowInput = z.input<typeof SetFollowSchema>;

const UserIdSchema = z.number().int().positive();

export const FollowRequestResponseSchema = z.object({
  followerId: UserIdSchema,
  accept: z.boolean(),
});

export type FollowRequestResponseInput = z.infer<typeof FollowRequestResponseSchema>;

export const RemoveFollowerSchema = z.object({
  followerId: UserIdSchema,
});

export type RemoveFollowerInput = z.infer<typeof RemoveFollowerSchema>;

// `?after=<id akun>` pada daftar follow. Nilai tidak valid diperlakukan sebagai
// halaman pertama, bukan error.
export const FollowCursorSchema = z.coerce.number().int().positive().catch(0);
