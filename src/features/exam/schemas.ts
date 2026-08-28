import { z } from "zod";

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

export type ExamAnswerInput = z.infer<typeof ExamAnswerSchema>;
export type SubmitExamSessionInput = z.infer<typeof SubmitExamSessionSchema>;
