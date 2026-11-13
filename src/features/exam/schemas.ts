import { z } from "zod";
import { JlptSection } from "@prisma/client";
import { EXAM_NOTE_MAX_LENGTH } from "./note";

// Juga dipakai lembar jawaban guest di `/result/guest` dan titipan klaimnya,
// yang tidak membawa catatan.
export const ExamAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  selectedAnswer: z.number().int().min(1).max(4).nullable(),
  flagged: z.boolean(),
});

// Lembar jawaban runner: jawaban beserta catatan selama mengerjakan. `note`
// opsional supaya tab yang dibuka sebelum fitur catatan tetap bisa menyimpan dan
// submit; nilai yang tidak dikirim tidak mengubah catatan tersimpan.
export const ExamSheetEntrySchema = ExamAnswerSchema.extend({
  note: z.string().max(EXAM_NOTE_MAX_LENGTH).optional(),
});

export const SubmitExamSessionSchema = z.object({
  attemptId: z.number().int().min(0),
  session: z.number().int().positive(),
  answers: z.array(ExamSheetEntrySchema).max(500),
});

// Simpan otomatis hanya mengirim soal yang berubah sejak simpanan terakhir.
export const SaveExamAnswersSchema = z.object({
  attemptId: z.number().int().positive(),
  session: z.number().int().positive(),
  answers: z.array(ExamSheetEntrySchema).min(1).max(500),
});

export const GuestExamCookieSchema = z.object({
  testPackageId: z.number().int().positive(),
  sectionScope: z.nativeEnum(JlptSection).nullable(),
  // Ditambahkan belakangan agar attempt hasil impor punya durasi nyata; cookie
  // yang dibuat sebelum ini tidak memilikinya, jadi tetap optional.
  startedAt: z.iso.datetime().optional(),
});

export type ExamAnswerInput = z.infer<typeof ExamAnswerSchema>;
export type ExamSheetEntryInput = z.infer<typeof ExamSheetEntrySchema>;
export type SubmitExamSessionInput = z.infer<typeof SubmitExamSessionSchema>;
export type SaveExamAnswersInput = z.infer<typeof SaveExamAnswersSchema>;
