"use server";

import { redirect } from "next/navigation";
import { CONVERSATION_CHAT_MODEL, CONVERSATION_PROVIDER, FEATURES } from "@/constants";
import { CONVERSATION_PROMPT_VERSION, CONVERSATION_RUBRIC_VERSION } from "@/constants/conversation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { reportServerError } from "@/lib/server-logger";
import {
  ConversationSessionIdSchema,
  ConversationSetupSchema,
  GenerateReplySchema,
  RequestFeedbackSchema,
  UpdateDisplayPreferenceSchema,
} from "./schemas";
import { findPersona } from "./data/personas";
import { ChatProviderError, getChatProvider } from "./lib/provider";
import {
  DENIED,
  persistTurns,
  requireOwnedSession,
  toConversationLevel,
  type ActionFailure,
} from "./lib/session-guard";
import { recordConversationUsage } from "./lib/quota";

// Isi kolom JSON dibaca kembali sebagai unknown dan divalidasi, bukan di-cast.
const FeedbackCorrectionsSchema = z.array(
  z.object({
    original: z.string(),
    corrected: z.string(),
    reason: z.string(),
    severity: z.string(),
  }),
);

// Provider masih mock pada tahap ini, jadi tidak ada biaya. Yang berubah dari
// Tahap B: session dan turn kini tersimpan di database, dan pemakaian dicatat.

export async function startConversationSessionAction(input: unknown) {
  if (!FEATURES.conversation) return DENIED.disabled;

  const session = await getSession();
  if (!session) return DENIED.unauthorized;

  const parsed = ConversationSetupSchema.safeParse(input);
  if (!parsed.success) return DENIED.invalid;
  if (parsed.data.mode === "VOICE" && !FEATURES.speaking) return DENIED.disabled;

  const persona = findPersona(parsed.data.personaKey);
  if (!persona) return DENIED.invalid;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { allowConversationStorage: true },
  });
  if (!user) return DENIED.unauthorized;

  // Consent di-snapshot saat session dibuat. Mencabutnya kemudian memicu
  // penghapusan, bukan penafsiran ulang data lama (§4.5).
  const transcriptRetained = user.allowConversationStorage;

  const created = await prisma.conversationSession.create({
    data: {
      userId: session.userId,
      mode: parsed.data.mode,
      personaKey: parsed.data.personaKey,
      topicKeys: [...parsed.data.topicKeys],
      jlptLevel: parsed.data.jlptLevel,
      showTranslation: parsed.data.showTranslation,
      showRomaji: parsed.data.showRomaji,
      showFurigana: parsed.data.showFurigana,
      transcriptRetained,
      promptVersion: CONVERSATION_PROMPT_VERSION,
      chatModel: CONVERSATION_PROVIDER === "mock" ? "mock" : CONVERSATION_CHAT_MODEL,
      // turnCount mengikuti jumlah baris turn. Sapaan pembuka menempati order 0,
      // jadi tanpa ini giliran pertama akan menulis order 0 lagi dan menabrak
      // unique [sessionId, order].
      turnCount: transcriptRetained ? 1 : 0,
      // Sapaan pembuka berasal dari fixture persona, jadi tidak ada permintaan
      // ke provider dan tidak ada biaya sebelum user bicara (CONV-3).
      turns: transcriptRetained
        ? {
            create: {
              order: 0,
              role: "ASSISTANT",
              contentJa: persona.greeting,
              contentTranslation: persona.greetingTranslation,
              contentRomaji: persona.greetingRomaji,
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  redirect(`${parsed.data.mode === "VOICE" ? "/speaking" : "/conversation"}/${created.id}`);
}

export type ConversationReplyResult =
  | {
      ok: true;
      contentJa: string;
      contentTranslation: string | null;
      contentRomaji: string | null;
      /** ID giliran pelajar di database; null bila transcript tidak disimpan. */
      userTurnId: number | null;
    }
  | ActionFailure;

export async function generateConversationReplyAction(
  input: unknown,
): Promise<ConversationReplyResult> {
  const parsed = GenerateReplySchema.safeParse(input);
  if (!parsed.success) return DENIED.invalid;

  const gate = await requireOwnedSession(parsed.data.sessionId);
  if (!gate.ok) return gate;

  const { mockFailure, ...request } = parsed.data;

  try {
    const reply = await getChatProvider().reply({
      personaKey: gate.conversation.personaKey,
      jlptLevel: toConversationLevel(gate.conversation.jlptLevel),
      topicKeys: gate.conversation.topicKeys,
      userMessage: request.userMessage,
      history: request.history.map((turn) => ({
        role: turn.role,
        contentJa: turn.contentJa,
      })),
      mockFailure,
    });

    const persisted = await persistTurns({
      sessionId: gate.conversation.id,
      userId: gate.userId,
      transcriptRetained: gate.conversation.transcriptRetained,
      startOrder: gate.conversation.turnCount,
      userMessage: request.userMessage,
      inputSource: request.inputSource,
      reply,
    });

    return {
      ok: true,
      contentJa: reply.contentJa,
      contentTranslation: reply.contentTranslation,
      contentRomaji: reply.contentRomaji,
      userTurnId: persisted.userTurnId,
    };
  } catch (error) {
    if (error instanceof ChatProviderError) {
      return { ok: false, reason: error.reason, message: error.message };
    }

    // Isi pesan user tidak ikut dicatat (NF-7).
    reportServerError("conversation.generate_reply_failed", error);
    return {
      ok: false,
      reason: "provider_error",
      message: "Terjadi kesalahan tak terduga. Coba kirim ulang pesanmu.",
    };
  }
}

export async function updateDisplayPreferenceAction(input: unknown) {
  const parsed = UpdateDisplayPreferenceSchema.safeParse(input);
  if (!parsed.success) return DENIED.invalid;

  const gate = await requireOwnedSession(parsed.data.sessionId);
  if (!gate.ok) return gate;

  await prisma.conversationSession.update({
    where: { id: gate.conversation.id },
    data: {
      showTranslation: parsed.data.showTranslation,
      showRomaji: parsed.data.showRomaji,
      showFurigana: parsed.data.showFurigana,
    },
  });

  return { ok: true } as const;
}

export async function deleteConversationSessionAction(input: unknown) {
  const parsed = ConversationSessionIdSchema.safeParse(input);
  if (!parsed.success) return DENIED.invalid;

  const gate = await requireOwnedSession(parsed.data.sessionId);
  if (!gate.ok) return gate;

  // Turn dan feedback ikut terhapus lewat cascade pada foreign key.
  await prisma.conversationSession.delete({ where: { id: gate.conversation.id } });

  return { ok: true } as const;
}

export type TurnFeedbackResult =
  | {
      ok: true;
      corrections: { original: string; corrected: string; reason: string; severity: string }[];
      summary: string;
    }
  | ActionFailure;

/**
 * Koreksi terstruktur untuk satu giliran pelajar (CONV-7).
 *
 * Dipanggil atas permintaan, bukan otomatis tiap giliran — itu menghemat sekitar
 * separuh biaya dan tidak mengganggu alur latihan (keputusan terbuka #5).
 *
 * Hanya tersedia bila transcript disimpan, karena koreksi menempel pada baris
 * turn di database.
 */
export async function requestTurnFeedbackAction(input: unknown): Promise<TurnFeedbackResult> {
  if (!FEATURES.conversation) return DENIED.disabled;

  const parsed = RequestFeedbackSchema.safeParse(input);
  if (!parsed.success) return DENIED.invalid;

  const session = await getSession();
  if (!session) return DENIED.unauthorized;

  // Kepemilikan ditelusuri lewat relasi session, bukan diterima dari client.
  const turn = await prisma.conversationTurn.findFirst({
    where: { id: parsed.data.turnId, role: "USER", session: { userId: session.userId } },
    select: {
      id: true,
      contentJa: true,
      session: { select: { personaKey: true, jlptLevel: true } },
      feedback: { select: { corrections: true, summary: true } },
    },
  });
  if (!turn) return DENIED.notFound;

  // Sudah pernah dikoreksi: kembalikan yang tersimpan alih-alih membayar ulang.
  if (turn.feedback) {
    const cached = FeedbackCorrectionsSchema.safeParse(turn.feedback.corrections);
    if (cached.success) {
      return { ok: true, corrections: cached.data, summary: turn.feedback.summary };
    }
  }

  try {
    const result = await getChatProvider().feedback({
      personaKey: turn.session.personaKey,
      jlptLevel: toConversationLevel(turn.session.jlptLevel),
      userMessage: turn.contentJa,
    });

    await prisma.conversationTurnFeedback.create({
      data: {
        turnId: turn.id,
        rubricVersion: CONVERSATION_RUBRIC_VERSION,
        corrections: result.corrections,
        summary: result.summary,
      },
    });

    const timeZone = await getUserTimeZone(session.userId);
    await recordConversationUsage(session.userId, timeZone, {
      inputTokens: result.inputTokens ?? 0,
      outputTokens: result.outputTokens ?? 0,
    });

    return { ok: true, corrections: result.corrections, summary: result.summary };
  } catch (error) {
    if (error instanceof ChatProviderError) {
      return { ok: false, reason: error.reason, message: error.message };
    }

    reportServerError("conversation.feedback_failed", error);
    return {
      ok: false,
      reason: "provider_error",
      message: "Koreksi gagal dibuat. Coba lagi sebentar.",
    };
  }
}
