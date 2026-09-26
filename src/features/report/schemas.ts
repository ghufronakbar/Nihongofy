import { z } from "zod";
import {
  REPORT_CATEGORIES,
  REPORT_MESSAGE_MAX_LENGTH,
  REPORT_MESSAGE_MIN_LENGTH,
  REPORT_PAGE_PATH_MAX_LENGTH,
  isReportCategoryAllowed,
} from "./constants";

// Dua aturan berbeda ditegakkan di sini:
//
// 1. Target wajib ada untuk targetType yang bukan GENERAL — lewat discriminated
//    union. CHECK constraint di database tidak dapat melakukannya karena FK
//    target memakai ON DELETE SET NULL, jadi `questionId IS NOT NULL` akan
//    menggagalkan penghapusan soal itu sendiri.
// 2. Kategori dibatasi target — lewat `superRefine` yang membaca peta di
//    `constants.ts`. Sengaja bukan enum per varian: enum sempit membuat tipe
//    input form ikut menyempit dan memaksa penyempitan tipe di client, padahal
//    yang berwenang menolak tetap server.

const messageField = z
  .string()
  .trim()
  .min(
    REPORT_MESSAGE_MIN_LENGTH,
    `Ceritakan minimal ${REPORT_MESSAGE_MIN_LENGTH} karakter supaya dapat ditindak.`,
  )
  .max(REPORT_MESSAGE_MAX_LENGTH, `Maksimal ${REPORT_MESSAGE_MAX_LENGTH} karakter.`);

// Alamat balasan opsional dan hanya dipakai guest. String kosong disamakan dengan
// tidak diisi supaya field yang dibiarkan kosong tidak menjadi error.
const replyEmailInputField = z.union([
  z.literal(""),
  z.email("Format email tidak valid.").max(320),
]);

// Varian untuk action: field yang dibiarkan kosong menjadi `undefined` supaya
// kolomnya tersimpan NULL, bukan string kosong.
const replyEmailField = replyEmailInputField
  .optional()
  .transform((value) => (value ? value : undefined));

// Hanya path internal. URL absolut dari client tidak menambah informasi dan
// membuka celah untuk menitipkan host asing ke layar admin.
const pagePathField = z
  .union([
    z.literal(""),
    z
      .string()
      .max(REPORT_PAGE_PATH_MAX_LENGTH)
      .startsWith("/", "Path halaman tidak valid."),
  ])
  .optional()
  .transform((value) => (value ? value : undefined));

const sharedFields = {
  category: z.enum(REPORT_CATEGORIES, { error: "Pilih dulu jenis laporannya." }),
  message: messageField,
  replyEmail: replyEmailField,
  // Dipakai guest. Kosong untuk user login: token diverifikasi hanya bila tidak
  // ada session, dan server yang memutuskannya, bukan client.
  turnstileToken: z.string().default(""),
  // User login memilih apakah admin boleh membalas ke email akunnya. Alamatnya
  // diambil server dari `session.userId`, tidak pernah dari client.
  useAccountEmail: z.boolean().default(false),
  pagePath: pagePathField,
};

const questionId = z.number().int().positive();

export const SubmitReportSchema = z
  .discriminatedUnion("targetType", [
    z.object({ targetType: z.literal("GENERAL"), ...sharedFields }),
    z.object({ targetType: z.literal("QUESTION"), questionId, ...sharedFields }),
    z.object({
      targetType: z.literal("QUESTION_EXPLANATION"),
      // Pembahasan dilaporkan lewat questionId, bukan id pembahasannya:
      // pembahasan di-upsert oleh generator dan layar perbaikannya memang
      // /admin/explanation/[questionId].
      questionId,
      ...sharedFields,
    }),
    z.object({
      targetType: z.literal("ARTICLE"),
      articleId: z.number().int().positive(),
      ...sharedFields,
    }),
    z.object({
      targetType: z.literal("COMMENT"),
      commentId: z.number().int().positive(),
      ...sharedFields,
    }),
  ])
  .superRefine((value, context) => {
    if (isReportCategoryAllowed(value.targetType, value.category)) return;
    context.addIssue({
      code: "custom",
      path: ["category"],
      message: "Jenis laporan tidak cocok dengan hal yang dilaporkan.",
    });
  });

export type SubmitReportInput = z.input<typeof SubmitReportSchema>;
export type SubmitReportValues = z.infer<typeof SubmitReportSchema>;

/** Identitas target tanpa isi form — dipakai komponen tombol sebagai props. */
export type ReportTarget =
  | { targetType: "GENERAL" }
  | { targetType: "QUESTION"; questionId: number }
  | { targetType: "QUESTION_EXPLANATION"; questionId: number }
  | { targetType: "ARTICLE"; articleId: number }
  | { targetType: "COMMENT"; commentId: number };

export type ReportSubmitResult = { ok: boolean; message: string };

/**
 * Skema untuk field yang benar-benar diisi di form. Target dan `pagePath`
 * ditempelkan saat submit, jadi tidak ikut di sini. Field-nya berbagi definisi
 * dengan `SubmitReportSchema` di atas supaya aturan panjang teks dan format email
 * tidak punya dua versi.
 */
export const ReportFormSchema = z.object({
  category: sharedFields.category,
  message: messageField,
  // Varian tanpa transform: `z.input` dan `z.output` harus sama supaya
  // react-hook-form memakai satu tipe untuk field dan untuk handler submit.
  replyEmail: replyEmailInputField,
  useAccountEmail: z.boolean(),
  turnstileToken: z.string(),
});

export type ReportFormValues = z.infer<typeof ReportFormSchema>;
