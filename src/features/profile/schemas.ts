import { z } from "zod";
import { EmailSchema, PasswordSchema } from "@/features/auth/schemas";

const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, "Nama tampilan minimal 2 karakter.")
  .max(50, "Nama tampilan maksimal 50 karakter.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Nama tampilan tidak valid.");

const AvatarUrlSchema = z
  .url("URL avatar tidak valid.")
  .max(2048, "URL avatar terlalu panjang.")
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  }, "Avatar harus berasal dari upload Cloudinary aplikasi.");

export const UpdateProfileSchema = z.object({
  displayName: DisplayNameSchema,
  email: EmailSchema,
  avatarUrl: AvatarUrlSchema.nullable(),
  currentPassword: z.string().max(72, "Password maksimal 72 karakter.").optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password belum sama.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Gunakan password baru yang berbeda.",
    path: ["newPassword"],
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
