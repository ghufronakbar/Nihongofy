import "server-only";

import { prisma } from "@/lib/prisma";

// Consent user mengikat admin. `ConversationSession.transcriptRetained` dan
// `audioRetained` adalah snapshot izin saat session dibuat, dan layar ini tidak
// pernah membaca isi `ConversationTurn` untuk session yang tidak mengizinkannya.
// Agregat pemakaian tetap tersedia tanpa membuka isi percakapan — itu memang
// alasan `ConversationQuota` ada.

export async function getConversationOverview() {
  const today = new Date();
  const since = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totals, sessions, flagged, staleRetention, quotaRows] = await Promise.all([
    prisma.conversationQuota.aggregate({
      where: { quotaDate: { gte: since } },
      _sum: { turnCount: true, audioSeconds: true, inputTokens: true, outputTokens: true },
    }),
    prisma.conversationSession.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.conversationTurn.count({ where: { moderationFlagged: true } }),
    // Retensi yang sudah lewat tetapi datanya masih ada. Pembersihannya belum
    // otomatis, jadi layar ini yang memberi tahu kalau ada yang tertinggal.
    prisma.conversationSession.count({
      where: { retentionExpiresAt: { lt: today }, transcriptRetained: true },
    }),
    prisma.conversationQuota.findMany({
      where: { quotaDate: { gte: since } },
      orderBy: [{ quotaDate: "desc" }, { turnCount: "desc" }],
      take: 100,
      select: {
        id: true,
        quotaDate: true,
        turnCount: true,
        audioSeconds: true,
        inputTokens: true,
        outputTokens: true,
        user: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  return {
    totals: {
      turns: totals._sum.turnCount ?? 0,
      audioSeconds: totals._sum.audioSeconds ?? 0,
      inputTokens: totals._sum.inputTokens ?? 0,
      outputTokens: totals._sum.outputTokens ?? 0,
    },
    sessions,
    flagged,
    staleRetention,
    quotaRows,
  };
}

// Turn yang ditandai moderation. Isi teksnya hanya dibaca bila session-nya
// memang mengizinkan penyimpanan transcript; bila tidak, yang tampil hanya
// keberadaan penandanya.
export async function listFlaggedTurns() {
  const rows = await prisma.conversationTurn.findMany({
    where: { moderationFlagged: true },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      role: true,
      createdAt: true,
      contentJa: true,
      session: {
        select: {
          id: true,
          transcriptRetained: true,
          jlptLevel: true,
          mode: true,
          user: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    createdAt: row.createdAt,
    session: row.session,
    // Consent dicek di layer query, bukan di komponen: kalau penyaringannya
    // hanya di JSX, isinya tetap ikut terkirim dalam payload halaman.
    contentJa: row.session.transcriptRetained ? row.contentJa : null,
  }));
}
