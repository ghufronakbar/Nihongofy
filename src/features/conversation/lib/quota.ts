import "server-only";

import { prisma } from "@/lib/prisma";
import { getZonedCalendarDate } from "@/lib/time-zone";

// Pencatatan pemakaian harian per user.
//
// Keputusan tahap sekarang: pemakaian DICATAT tetapi TIDAK DITOLAK. Angka batas
// akan datang dari modul plan/pricing terpisah, bukan di-hardcode di sini.
// Pencatatannya tetap berjalan sejak sekarang supaya nanti ada data nyata untuk
// menentukan angka paket yang masuk akal.
//
// PERINGATAN RILIS: penegakan batas wajib aktif sebelum provider nyata berjalan
// dengan API key. Tanpa batas, satu akun dapat menghabiskan biaya tanpa plafon.

export type QuotaUsage = {
  turnCount: number;
  audioSeconds: number;
  inputTokens: number;
  outputTokens: number;
};

/** Awal hari menurut zona waktu user, disimpan sebagai kolom DATE. */
function quotaDateFor(timeZone: string, now = new Date()) {
  const { year, month, day } = getZonedCalendarDate(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Menambah counter hari ini secara atomik.
 *
 * Memakai `INSERT ... ON CONFLICT DO UPDATE` seperti `AuthRateLimit`, bukan pola
 * select-lalu-update, supaya dua permintaan bersamaan tidak saling menimpa.
 */
export async function recordConversationUsage(
  userId: number,
  timeZone: string,
  usage: Partial<QuotaUsage>,
) {
  const quotaDate = quotaDateFor(timeZone);

  await prisma.$executeRaw`
    INSERT INTO "ConversationQuota" (
      "userId", "quotaDate", "turnCount", "audioSeconds",
      "inputTokens", "outputTokens", "createdAt", "updatedAt"
    )
    VALUES (
      ${userId}, ${quotaDate}::date, ${usage.turnCount ?? 0}, ${usage.audioSeconds ?? 0},
      ${usage.inputTokens ?? 0}, ${usage.outputTokens ?? 0}, NOW(), NOW()
    )
    ON CONFLICT ("userId", "quotaDate") DO UPDATE SET
      "turnCount"    = "ConversationQuota"."turnCount"    + EXCLUDED."turnCount",
      "audioSeconds" = "ConversationQuota"."audioSeconds" + EXCLUDED."audioSeconds",
      "inputTokens"  = "ConversationQuota"."inputTokens"  + EXCLUDED."inputTokens",
      "outputTokens" = "ConversationQuota"."outputTokens" + EXCLUDED."outputTokens",
      "updatedAt"    = NOW()
  `;
}

/** Pemakaian hari ini. Dipakai UI untuk menampilkan angka, bukan untuk menolak. */
export async function getTodayUsage(userId: number, timeZone: string): Promise<QuotaUsage> {
  const row = await prisma.conversationQuota.findUnique({
    where: { userId_quotaDate: { userId, quotaDate: quotaDateFor(timeZone) } },
    select: { turnCount: true, audioSeconds: true, inputTokens: true, outputTokens: true },
  });

  return row ?? { turnCount: 0, audioSeconds: 0, inputTokens: 0, outputTokens: 0 };
}
