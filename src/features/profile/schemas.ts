import { z } from "zod";
import { AVATAR_MAX_FILE_SIZE_BYTES } from "@/constants/storage";
import { PasswordSchema } from "@/features/auth/schemas";
import { isValidTimeZone } from "@/lib/time-zone";
import { UsernameSchema } from "@/lib/username";

const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, "Nama tampilan minimal 2 karakter.")
  .max(50, "Nama tampilan maksimal 50 karakter.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Nama tampilan tidak valid.");

const AvatarUrlSchema = z
  .url("URL avatar tidak valid.")
  .max(2048, "URL avatar terlalu panjang.");

// Menyimpan object key R2 (mis. `jlpt-exam/avatars/42/<uuid>.webp`). Titik
// diizinkan untuk ekstensi; kepemilikan diverifikasi ulang di server.
const AvatarPublicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9/._-]+$/, "Public ID avatar tidak valid.");

export const CreateAvatarUploadSchema = z.object({
  byteLength: z
    .number()
    .int()
    .positive()
    .max(AVATAR_MAX_FILE_SIZE_BYTES, "Ukuran avatar maksimal 3MB."),
});

export const TimeZoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone wajib diisi.")
  .max(100, "Timezone terlalu panjang.")
  .refine(isValidTimeZone, "Gunakan nama timezone IANA yang valid.");

// Bio profil publik: teks polos satu baris. Spasi berurutan dirapatkan supaya
// baris baru dari tempelan tidak lolos; string kosong disimpan sebagai null.
export const BIO_MAX_LENGTH = 160;

const BioSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .max(BIO_MAX_LENGTH, `Bio maksimal ${BIO_MAX_LENGTH} karakter.`)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Bio tidak valid."),
  )
  .transform((value) => (value === "" ? null : value));

export const JlptTargetSchema = z.enum(["N5", "N4", "N3", "N2", "N1"]).nullable();

export const UpdateProfileSchema = z.object({
  displayName: DisplayNameSchema,
  // Nama publik. Aturan dan daftar kata terlarangnya di `src/lib/username.ts`.
  username: UsernameSchema,
  avatarUrl: AvatarUrlSchema.nullable(),
  avatarPublicId: AvatarPublicIdSchema.nullable(),
  timeZone: TimeZoneSchema,
  bio: BioSchema.nullable(),
  jlptTarget: JlptTargetSchema,
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

export type CreateAvatarUploadInput = z.infer<typeof CreateAvatarUploadSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;
export type DisconnectGoogleInput = z.infer<typeof DisconnectGoogleSchema>;
export type PrivacyPreferencesInput = z.infer<typeof PrivacyPreferencesSchema>;
export type RequestAccountDeletionInput = z.infer<typeof RequestAccountDeletionSchema>;
export type CancelAccountDeletionInput = z.infer<typeof CancelAccountDeletionSchema>;
