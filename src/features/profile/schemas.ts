import { z } from "zod";
import { PasswordSchema } from "@/features/auth/schemas";
import { isValidTimeZone } from "@/lib/time-zone";

const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, "Nama tampilan minimal 2 karakter.")
  .max(50, "Nama tampilan maksimal 50 karakter.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Nama tampilan tidak valid.");

const AvatarUrlSchema = z
  .url("URL avatar tidak valid.")
  .max(2048, "URL avatar terlalu panjang.");

const AvatarPublicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9/_-]+$/, "Public ID avatar tidak valid.");

export const TimeZoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone wajib diisi.")
  .max(100, "Timezone terlalu panjang.")
  .refine(isValidTimeZone, "Gunakan nama timezone IANA yang valid.");

export const UpdateProfileSchema = z.object({
  displayName: DisplayNameSchema,
  avatarUrl: AvatarUrlSchema.nullable(),
  avatarPublicId: AvatarPublicIdSchema.nullable(),
  timeZone: TimeZoneSchema,
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

export const SetPasswordSchema = z
  .object({
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Konfirmasi password belum sama.",
    path: ["confirmPassword"],
  });

export const DisconnectGoogleSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi.").max(72),
});

export const PrivacyPreferencesSchema = z.object({
  allowAudioStorage: z.boolean(),
  allowConversationStorage: z.boolean(),
});

export const RequestAccountDeletionSchema = z.object({
  currentPassword: z.string().max(72).optional(),
  confirmation: z
    .string()
    .trim()
    .refine(
      (value): boolean => value === "HAPUS AKUN",
      'Ketik "HAPUS AKUN" untuk melanjutkan.',
    ),
});

export const CancelAccountDeletionSchema = z.object({
  currentPassword: z.string().max(72).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
export type DisconnectGoogleInput = z.infer<typeof DisconnectGoogleSchema>;
export type PrivacyPreferencesInput = z.infer<typeof PrivacyPreferencesSchema>;
export type RequestAccountDeletionInput = z.infer<typeof RequestAccountDeletionSchema>;
export type CancelAccountDeletionInput = z.infer<typeof CancelAccountDeletionSchema>;
