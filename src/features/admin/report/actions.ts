"use server";

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";
import {
  acquireEmailCooldown,
  releaseEmailCooldown,
} from "@/features/auth/lib/email-cooldown";
import { sendReportReplyMail } from "@/features/report/lib/report-reply-mail";
import { REPORT_STATUS_LABELS } from "@/features/report/constants";
import { recordAdminActionTx } from "../audit";
import {
  ReplyToReportSchema,
  SetReportStatusSchema,
  type ReplyToReportInput,
  type SetReportStatusInput,
} from "./schemas";

// Tidak ada invalidasi cache di sini: antrean laporan sengaja tidak di-cache dan
// tidak punya tag di CACHE_TAGS, karena layar ini justru dibuka untuk melihat
// keadaan sekarang.

/**
 * Menyetel status laporan sekaligus mencatat siapa yang menanganinya.
 *
 * `handledAt`/`handledById` diisi pada perubahan status pertama dan tidak
 * ditimpa sesudahnya: yang ingin diketahui adalah siapa yang mengambil laporan
 * ini, bukan siapa yang terakhir menyentuhnya.
 */
export async function setReportStatusAction(input: SetReportStatusInput) {
  const actor = await requireAdmin();

  const validated = SetReportStatusSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const { reportId, status, adminNote } = validated.data;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, handledById: true, handledAt: true },
  });
  if (!report) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: report.id },
      data: {
        status,
        handledById: report.handledById ?? actor.user.id,
        handledAt: report.handledAt ?? new Date(),
        ...(adminNote === undefined ? {} : { adminNote: adminNote === "" ? null : adminNote }),
      },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "report.status",
      targetType: "report",
      targetId: report.id,
      // Tanpa isi laporan maupun catatan internal: baris audit bertahan lebih
      // lama daripada data yang dirujuknya.
      summary: `Status laporan diubah menjadi ${REPORT_STATUS_LABELS[status]}.`,
    });
  });
}

/**
 * Mengirim satu balasan email ke pelapor. Tidak pernah otomatis, dan tidak pernah
 * lebih dari sekali per laporan — `repliedAt` yang terisi menutup jalurnya.
 *
 * Emailnya dikirim lebih dulu, baru barisnya ditulis. Urutan sebaliknya akan
 * menghasilkan laporan yang tercatat "sudah dibalas" padahal SMTP menolak, dan
 * tidak ada cara membedakannya dari balasan yang benar-benar terkirim.
 */
export async function replyToReportAction(input: ReplyToReportInput) {
  const actor = await requireAdmin();

  const validated = ReplyToReportSchema.safeParse(input);
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message ?? "Data tidak valid.");
  }

  const { reportId, replyMessage } = validated.data;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, category: true, createdAt: true, replyEmail: true, repliedAt: true },
  });
  if (!report) notFound();

  if (!report.replyEmail) {
    throw new Error("Pelapor tidak meninggalkan alamat email, jadi tidak ada yang dapat dibalas.");
  }
  if (report.repliedAt) {
    throw new Error("Laporan ini sudah dibalas sekali. Balasan kedua tidak dikirim.");
  }

  // Cooldown Redis menjaga dari klik ganda dan dari satu laporan yang dipakai
  // memberondong satu alamat; `repliedAt` di atas yang menjadi penjaga utamanya.
  const cooldown = await acquireEmailCooldown("report-reply", String(report.id));
  if (!cooldown.allowed) {
    throw new Error(
      `Balasan untuk laporan ini baru saja diproses. Tunggu ${cooldown.retryAfterSeconds} detik.`,
    );
  }

  try {
    await sendReportReplyMail({
      to: report.replyEmail,
      category: report.category,
      createdAt: report.createdAt,
      replyMessage,
    });
  } catch (error) {
    await releaseEmailCooldown("report-reply", String(report.id), cooldown.nonce);
    reportServerError("report.reply_send_failed", error, { reportId: report.id });
    throw new Error("Email balasan gagal dikirim. Laporan tidak ditandai sudah dibalas.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: report.id },
        data: {
          repliedAt: new Date(),
          repliedById: actor.user.id,
          replyMessage,
        },
      });
      await recordAdminActionTx(tx, {
        actor,
        action: "report.reply",
        targetType: "report",
        targetId: report.id,
        // Tanpa isi balasan dan tanpa alamat email.
        summary: "Balasan email dikirim ke pelapor.",
      });
    });
  } catch (error) {
    reportServerError("report.reply_record_failed", error, { reportId: report.id });
    throw new Error(
      "Email sudah terkirim, tetapi statusnya gagal dicatat. JANGAN kirim ulang — periksa laporan ini lagi setelah beberapa saat.",
    );
  }
}
