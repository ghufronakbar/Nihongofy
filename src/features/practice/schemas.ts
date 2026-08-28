import { z } from "zod";

export const PRACTICE_LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
export const PRACTICE_SECTIONS = ["MOJI_GOI", "BUNPOU", "DOKKAI", "CHOUKAI"] as const;
export const PRACTICE_MONDAI_TYPES = [
  "MOJI_GOI_READ_KANJI",
  "MOJI_GOI_WRITE_KANJI",
  "MOJI_GOI_WORD_FORMATION",
  "MOJI_GOI_CONTEXT",
  "MOJI_GOI_SYNONYM",
  "MOJI_GOI_WORD_USAGE",
  "BUNPOU_GRAMMAR",
  "BUNPOU_SENTENCE_COMPOSITION",
  "BUNPOU_TEXT_GRAMMAR",
  "DOKKAI_SHORT_TEXT",
  "DOKKAI_MEDIUM_TEXT",
  "DOKKAI_LONG_TEXT",
  "DOKKAI_INTEGRATED",
  "DOKKAI_MAIN_IDEA",
  "DOKKAI_INFORMATION_RETRIEVAL",
  "CHOUKAI_TASK_BASED",
  "CHOUKAI_MAIN_POINT",
  "CHOUKAI_OUTLINE",
  "CHOUKAI_EXPRESSION",
  "CHOUKAI_QUICK_RESPONSE",
  "CHOUKAI_INTEGRATED",
] as const;

export const PracticeConfigurationSchema = z.object({
  jlptLevel: z.enum(PRACTICE_LEVELS),
  section: z.enum(PRACTICE_SECTIONS),
  mondaiType: z.enum(PRACTICE_MONDAI_TYPES),
  questionCount: z.number().int().min(1).max(20),
});

export const PracticeSessionIdSchema = z.object({
  sessionId: z.number().int().min(0),
});

export const SubmitPracticeAnswerSchema = PracticeSessionIdSchema.extend({
  questionId: z.number().int().positive(),
  selectedAnswer: z.number().int().min(1).max(4),
});

export type PracticeConfigurationInput = z.infer<typeof PracticeConfigurationSchema>;
export type PracticeSessionIdInput = z.infer<typeof PracticeSessionIdSchema>;
export type SubmitPracticeAnswerInput = z.infer<typeof SubmitPracticeAnswerSchema>;
