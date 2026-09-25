import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";
import type { SessionUser } from "@/lib/auth";

export type AdminAuditEntry = {
  actor: SessionUser;
  /** Format "domain.aksi", mis. "article.publish". */
  action: string;
  targetType: string;
  targetId?: string | number | null;
  /**
   * Satu baris yang dapat dibaca tanpa membuka data aslinya. JANGAN memuat isi
   * konten, kredensial, atau data pribadi — baris log ini bertahan lebih lama
   * daripada data yang dirujuknya, dan anonimisasi akun hanya membersihkan
   * `actorName`, bukan isi `summary`.
   */
  summary: string;
};

function toRow(entry: AdminAuditEntry): Prisma.AdminAuditLogUncheckedCreateInput {
  return {
    actorId: entry.actor.user.id,
    actorName: entry.actor.user.displayName.slice(0, 120),
    action: entry.action.slice(0, 64),
    targetType: entry.targetType.slice(0, 40),
    targetId: entry.targetId === null || entry.targetId === undefined
      ? null
      : String(entry.targetId).slice(0, 64),
    summary: entry.summary,
  };
}

/**
 * Mencatat aksi admin **di dalam transaksi yang sama** dengan mutasinya.
 *
 * Ini bentuk yang dipakai bila aksinya menulis ke database: tidak akan pernah
 * ada mutasi yang tersimpan tanpa catatannya, dan sebaliknya.
 */
export function recordAdminActionTx(tx: Prisma.TransactionClient, entry: AdminAuditEntry) {
  return tx.adminAuditLog.create({ data: toRow(entry) });
}

/**
 * Mencatat aksi yang efeknya berada di luar database — mencabut session di
 * Redis, mengosongkan bucket rate limit — sehingga tidak ada transaksi yang
 * dapat memayungi keduanya.
 *
 * Kegagalan menulis log tidak dilempar ulang: aksinya sudah terjadi dan tidak
 * dapat dibatalkan, jadi melaporkannya sebagai gagal akan lebih menyesatkan
 * daripada lubang pada audit trail. Kegagalannya tetap masuk log server.
 */
export async function recordAdminAction(entry: AdminAuditEntry) {
  try {
    await prisma.adminAuditLog.create({ data: toRow(entry) });
  } catch (error) {
    reportServerError("admin.audit.write_failed", error, {
      action: entry.action,
      targetType: entry.targetType,
    });
  }
}
