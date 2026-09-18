import "server-only";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Seluruh pembacaan berawal dari session.userId. `userId` dari client tidak
// pernah diterima sebagai sumber otorisasi (D-8).

export type ConversationSessionView = {
  id: number;
  mode: "TEXT" | "VOICE";
  personaKey: string;
  topicKeys: string[];
  jlptLevel: string;
  showTranslation: boolean;
  showRomaji: boolean;
  showFurigana: boolean;
  transcriptRetained: boolean;
  startedAt: string;
  turnCount: number;
  turns: {
    id: number;
    order: number;
    role: "USER" | "ASSISTANT";
    contentJa: string;
    contentTranslation: string | null;
    contentRomaji: string | null;
  }[];
};

export async function getConversationSession(
  sessionId: number,
): Promise<ConversationSessionView | null> {
  const session = await getSession();
  if (!session) return null;

  const row = await prisma.conversationSession.findFirst({
    // Kepemilikan menjadi bagian dari filter, bukan pemeriksaan setelahnya:
    // session milik orang lain tidak pernah terbaca sama sekali.
    where: { id: sessionId, userId: session.userId },
    select: {
      id: true,
      mode: true,
      personaKey: true,
      topicKeys: true,
      jlptLevel: true,
      showTranslation: true,
      showRomaji: true,
      showFurigana: true,
      transcriptRetained: true,
      startedAt: true,
      turnCount: true,
      turns: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          role: true,
          contentJa: true,
          contentTranslation: true,
          contentRomaji: true,
        },
      },
    },
  });

  if (!row) return null;

  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    turns: row.turns,
  };
}

export type ConversationSessionSummary = {
  id: number;
  mode: "TEXT" | "VOICE";
  personaKey: string;
  jlptLevel: string;
  startedAt: string;
  turnCount: number;
  transcriptRetained: boolean;
};

export async function listConversationSessions(
  mode: "TEXT" | "VOICE",
): Promise<ConversationSessionSummary[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await prisma.conversationSession.findMany({
    where: { userId: session.userId, mode },
    orderBy: { startedAt: "desc" },
    take: 30,
    select: {
      id: true,
      mode: true,
      personaKey: true,
      jlptLevel: true,
      startedAt: true,
      turnCount: true,
      transcriptRetained: true,
    },
  });

  return rows.map((row) => ({ ...row, startedAt: row.startedAt.toISOString() }));
}
