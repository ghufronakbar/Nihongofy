import { z } from "zod";
import {
  REPORT_ADMIN_NOTE_MAX_LENGTH,
  REPORT_CATEGORIES,
  REPORT_REPLY_MAX_LENGTH,
  REPORT_REPLY_MIN_LENGTH,
  REPORT_TARGET_TYPES,
} from "@/features/report/constants";

// Tab antrean, bukan status mentah: yang ditanyakan admin saat membuka layar ini
// adalah "apa yang belum selesai", dan itu mencakup OPEN maupun IN_REVIEW.
export const ReportStateFilterSchema = z.enum(["open", "done", "all"]);

export const ReportQuerySchema = z.object({
  state: ReportStateFilterSchema,
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
  category: z.enum(REPORT_CATEGORIES).optional(),
  query: z.string().trim().max(200),
});

// Status yang boleh disetel manual. OPEN tidak termasuk: mengembalikan laporan ke
// "belum disentuh" akan menghapus jejak siapa yang menanganinya.
export const SetReportStatusSchema = z.object({
  reportId: z.number().int().positive(),
  status: z.enum(["IN_REVIEW", "RESOLVED", "REJECTED", "DUPLICATE"]),
  adminNote: z.string().trim().max(REPORT_ADMIN_NOTE_MAX_LENGTH).optional(),
});

export const ReplyToReportSchema = z.object({
  reportId: z.number().int().positive(),
  replyMessage: z
    .string()
    .trim()
    .min(REPORT_REPLY_MIN_LENGTH, `Tulis minimal ${REPORT_REPLY_MIN_LENGTH} karakter.`)
    .max(REPORT_REPLY_MAX_LENGTH, `Maksimal ${REPORT_REPLY_MAX_LENGTH} karakter.`),
});

export type ReportStateFilter = z.infer<typeof ReportStateFilterSchema>;
export type ReportQueryInput = z.infer<typeof ReportQuerySchema>;
export type SetReportStatusInput = z.infer<typeof SetReportStatusSchema>;
export type ReplyToReportInput = z.infer<typeof ReplyToReportSchema>;
