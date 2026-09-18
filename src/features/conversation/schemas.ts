import { z } from "zod";
import { CONVERSATION_MAX_USER_CHARS } from "@/constants/conversation";
import { CONVERSATION_PERSONA_KEYS } from "./data/personas";
import { CONVERSATION_TOPIC_KEYS } from "./data/topics";
import { CONVERSATION_LEVELS } from "./types";

export const CONVERSATION_MODES = ["TEXT", "VOICE"] as const;
export const CONVERSATION_TURN_ROLES = ["USER", "ASSISTANT"] as const;
export const CONVERSATION_INPUT_SOURCES = ["TYPED", "SPEECH"] as const;

// Hanya dipakai tahap prototype: memaksa provider mock menghasilkan keadaan
// buruk agar setiap error state benar-benar teruji (§11.1 butir 2).
export const CONVERSATION_MOCK_FAILURES = [
  "none",
  "slow",
  "timeout",
  "provider_error",
  "quota_exceeded",
  "moderation_flagged",
] as const;

export const ConversationSetupSchema = z
  .object({
    mode: z.enum(CONVERSATION_MODES),
    personaKey: z.enum(CONVERSATION_PERSONA_KEYS),
    jlptLevel: z.enum(CONVERSATION_LEVELS),
    topicKeys: z.array(z.enum(CONVERSATION_TOPIC_KEYS)).max(3),
    showTranslation: z.boolean(),
    showRomaji: z.boolean(),
    showFurigana: z.boolean(),
  })
  .superRefine((value, context) => {
    // Mode teks butuh arah pembicaraan; mode suara tidak memakai topik karena
    // latihannya berfokus pada mengucapkan, bukan pada tema tertentu.
    if (value.mode === "TEXT" && value.topicKeys.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["topicKeys"],
        message: "Pilih minimal satu topik.",
      });
    }
  });

export const ConversationTurnSchema = z.object({
  role: z.enum(CONVERSATION_TURN_ROLES),
  contentJa: z.string(),
  contentTranslation: z.string().nullable(),
  contentRomaji: z.string().nullable(),
});

export const ConversationSessionIdSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const UpdateDisplayPreferenceSchema = ConversationSessionIdSchema.extend({
  showTranslation: z.boolean(),
  showRomaji: z.boolean(),
  showFurigana: z.boolean(),
});

export const RequestFeedbackSchema = z.object({
  turnId: z.number().int().positive(),
});

export const GenerateReplySchema = z.object({
  sessionId: z.number().int().positive(),
  // Isi giliran user. Diperlakukan sebagai data latihan, tidak pernah sebagai
  // instruksi terhadap peran, level, atau batasan persona.
  userMessage: z.string().trim().min(1).max(CONVERSATION_MAX_USER_CHARS),
  inputSource: z.enum(CONVERSATION_INPUT_SOURCES),
  history: z.array(ConversationTurnSchema).max(80),
  mockFailure: z.enum(CONVERSATION_MOCK_FAILURES).optional(),
});

export type ConversationSetupInput = z.infer<typeof ConversationSetupSchema>;
export type ConversationSessionIdInput = z.infer<typeof ConversationSessionIdSchema>;
export type UpdateDisplayPreferenceInput = z.infer<typeof UpdateDisplayPreferenceSchema>;
export type RequestFeedbackInput = z.infer<typeof RequestFeedbackSchema>;
export type ConversationTurnInput = z.infer<typeof ConversationTurnSchema>;
export type GenerateReplyInput = z.infer<typeof GenerateReplySchema>;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];
export type ConversationInputSource = (typeof CONVERSATION_INPUT_SOURCES)[number];
export type ConversationMockFailure = (typeof CONVERSATION_MOCK_FAILURES)[number];
