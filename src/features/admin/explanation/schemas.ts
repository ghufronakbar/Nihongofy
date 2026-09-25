import { z } from "zod";

export const ExplanationQueueFilterSchema = z.enum(["missing", "unreviewed", "doubt", "reviewed"]);

const optionalText = z
  .string()
  .trim()
  .max(8000)
  .transform((value) => (value.length === 0 ? null : value))
  .nullable();

// Alasan per pilihan. Fixture mewajibkan keempatnya ada sekaligus atau tidak
// sama sekali, jadi editor mengikuti aturan yang sama: menyimpan sebagian saja
// akan menghasilkan pembahasan yang merender tiga dari empat opsi.
const choiceReasonSchema = z.object({
  codeAnswer: z.number().int().min(1).max(4),
  reason: z.string().trim().max(4000),
});

export const UpdateExplanationSchema = z
  .object({
    questionId: z.number().int().positive(),
    summary: z.string().trim().min(1, "Ringkasan wajib diisi.").max(4000),
    detail: optionalText,
    translation: optionalText,
    // Textarea satu baris per poin; baris kosong dibuang.
    keyPointsText: z.string().max(4000),
    answerKeyDoubt: z.boolean(),
    answerKeyDoubtNote: optionalText,
    choices: z.array(choiceReasonSchema).length(4),
  })
  .superRefine((value, context) => {
    const filled = value.choices.filter((choice) => choice.reason.trim().length > 0);
    if (filled.length > 0 && filled.length < 4) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message:
          "Isi alasan untuk keempat pilihan, atau kosongkan semuanya. Sebagian saja membuat pembahasan merender opsi yang timpang.",
      });
    }
    if (value.answerKeyDoubt && !value.answerKeyDoubtNote) {
      context.addIssue({
        code: "custom",
        path: ["answerKeyDoubtNote"],
        message: "Jelaskan kenapa kunci jawabannya diragukan.",
      });
    }
  });

export const ApproveExplanationSchema = z.object({
  questionId: z.number().int().positive(),
});

export const UnapproveExplanationSchema = z.object({
  questionId: z.number().int().positive(),
});

export const ResolveAnswerKeyDoubtSchema = z.object({
  questionId: z.number().int().positive(),
});

export type ExplanationQueueFilter = z.infer<typeof ExplanationQueueFilterSchema>;
export type UpdateExplanationInput = z.infer<typeof UpdateExplanationSchema>;
export type ApproveExplanationInput = z.infer<typeof ApproveExplanationSchema>;
export type UnapproveExplanationInput = z.infer<typeof UnapproveExplanationSchema>;
export type ResolveAnswerKeyDoubtInput = z.infer<typeof ResolveAnswerKeyDoubtSchema>;
