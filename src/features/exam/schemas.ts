import { z } from "zod";
import { JlptSection } from "@prisma/client";

export const ExamAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  selectedAnswer: z.number().int().min(1).max(4).nullable(),
  flagged: z.boolean(),
});

export const SubmitExamSessionSchema = z.object({
  attemptId: z.number().int().min(0),
  session: z.number().int().positive(),
  answers: z.array(ExamAnswerSchema),
});

export const GuestExamCookieSchema = z.object({
  testPackageId: z.number().int().positive(),
  sectionScope: z.nativeEnum(JlptSection).nullable(),
});

export type ExamAnswerInput = z.infer<typeof ExamAnswerSchema>;
export type SubmitExamSessionInput = z.infer<typeof SubmitExamSessionSchema>;
