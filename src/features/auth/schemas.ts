import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .min(1, "Email wajib diisi.")
  .max(254, "Email terlalu panjang.")
  .email("Format email tidak valid.");

export const PasswordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter.")
  .max(72, "Password maksimal 72 karakter.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password maksimal 72 byte.",
  );

export const LoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Email atau username wajib diisi.")
    .max(254, "Email atau username terlalu panjang."),
  password: z.string().min(1, "Password wajib diisi."),
  next: z.string().max(2048).optional(),
});

export const RegisterSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Nama tampilan minimal 2 karakter.")
      .max(50, "Nama tampilan maksimal 50 karakter."),
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
    next: z.string().max(2048).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password belum sama.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
