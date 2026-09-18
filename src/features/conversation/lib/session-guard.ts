import "server-only";

import type { JlptLevel } from "@prisma/client";
import { FEATURES } from "@/constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { CONVERSATION_LEVELS, type ConversationLevel } from "../types";
import { recordConversationUsage } from "./quota";

// Helper bersama untuk Server Action dan route handler streaming.
//
// Dipisahkan dari `actions.ts` karena file bertanda "use server" mengharuskan
// seluruh ekspornya berupa async function — konstanta, tipe, dan fungsi sinkron
// tidak boleh berada di sana.

export type ActionFailure = {
  ok: false;
  reason:
    | "unauthorized"
    | "disabled"
    | "invalid_input"
    | "not_found"
    | "timeout"
    | "provider_error"
    | "quota_exceeded"
    | "moderation_blocked";
  message: string;
};

export const DENIED = {
  disabled: { ok: false, reason: "disabled", message: "Fitur percakapan sedang tidak aktif." },
  unauthorized: {
    ok: false,
    reason: "unauthorized",
    message: "Sesi tidak valid. Silakan masuk kembali.",
  },
  invalid: {
    ok: false,
    reason: "invalid_input",
    message: "Pesan tidak dapat diproses. Periksa panjang dan isinya.",
  },
  notFound: {
    ok: false,
    reason: "not_found",
    message: "Percakapan tidak ditemukan atau bukan milikmu.",
  },
} as const satisfies Record<string, ActionFailure>;

export type OwnedSession = {
  ok: true;
  userId: number;
  conversation: {
    id: number;
    transcriptRetained: boolean;
    turnCount: number;
    personaKey: string;
    jlptLevel: JlptLevel;
    topicKeys: string[];
  };
};

/** Session + kepemilikan + flag fitur. Dipakai setiap action sebagai gerbang. */
export async function requireOwnedSession(sessionId: number): Promise<OwnedSession | ActionFailure> {
  if (!FEATURES.conversation) return DENIED.disabled;

  const session = await getSession();
  if (!session) return DENIED.unauthorized;

  const conversation = await prisma.conversationSession.findFirst({
    where: { id: sessionId, userId: session.userId },
    select: {
      id: true,
      transcriptRetained: true,
      turnCount: true,
      // Persona, level, dan topik dibaca dari database, bukan dari client.
      // Kalau ikut dikirim client, satu user dapat menukar persona atau level
      // di tengah percakapan hanya dengan mengubah payload.
      personaKey: true,
      jlptLevel: true,
      topicKeys: true,
    },
  });
  if (!conversation) return DENIED.notFound;

  return { ok: true, userId: session.userId, conversation };
}

/**
 * Level pada database memakai enum JLPT penuh (N1-N5), sedangkan modul ini baru
 * mendukung N5-N3. Nilai di luar itu diturunkan ke level tertinggi yang
 * didukung alih-alih membuat permintaan gagal.
 */
export function toConversationLevel(level: JlptLevel): ConversationLevel {
  const supported = CONVERSATION_LEVELS as readonly string[];
  return supported.includes(level) ? (level as ConversationLevel) : "N3";
}

export type PersistArgs = {
  sessionId: number;
  userId: number;
  transcriptRetained: boolean;
  startOrder: number;
  userMessage: string;
  inputSource: "TYPED" | "SPEECH";
  reply: {
    contentJa: string;
    contentTranslation: string | null;
    contentRomaji: string | null;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    moderationFlagged: boolean;
  };
};

/**
 * Menulis giliran user dan balasan.
 *
 * Isi percakapan hanya disimpan bila consent aktif (D-1). Agregat pada session
 * dan counter harian tetap ditulis apa pun consentnya, sehingga pemakaian tetap
 * terhitung tanpa menyimpan isi percakapan.
 */
export async function persistTurns(args: PersistArgs): Promise<{ userTurnId: number | null }> {
  const inputTokens = args.reply.inputTokens ?? 0;
  const outputTokens = args.reply.outputTokens ?? 0;

  const userTurnId = await prisma.$transaction(async (tx) => {
    let createdUserTurnId: number | null = null;

    if (args.transcriptRetained) {
      const userTurn = await tx.conversationTurn.create({
        data: {
          sessionId: args.sessionId,
          order: args.startOrder,
          role: "USER",
          contentJa: args.userMessage,
          contentTranslation: null,
          contentRomaji: null,
          inputSource: args.inputSource,
        },
        select: { id: true },
      });
      createdUserTurnId = userTurn.id;

      await tx.conversationTurn.createMany({
        data: [
          {
            sessionId: args.sessionId,
            order: args.startOrder + 1,
            role: "ASSISTANT",
            contentJa: args.reply.contentJa,
            contentTranslation: args.reply.contentTranslation,
            contentRomaji: args.reply.contentRomaji,
            latencyMs: args.reply.latencyMs,
            inputTokens: args.reply.inputTokens,
            outputTokens: args.reply.outputTokens,
            moderationFlagged: args.reply.moderationFlagged,
          },
        ],
      });
    }

    await tx.conversationSession.update({
      where: { id: args.sessionId },
      data: {
        turnCount: { increment: 2 },
        totalInputTokens: { increment: inputTokens },
        totalOutputTokens: { increment: outputTokens },
      },
    });

    return createdUserTurnId;
  });

  const timeZone = await getUserTimeZone(args.userId);
  await recordConversationUsage(args.userId, timeZone, {
    turnCount: 1,
    inputTokens,
    outputTokens,
  });

  return { userTurnId };
}

