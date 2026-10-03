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
