"use server";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  HideDiscussionRootSchema,
  TakedownCommentSchema,
  RestoreCommentSchema,
  type HideDiscussionRootInput,
  type TakedownCommentInput,
  type RestoreCommentInput,
} from "./schemas";

// Action moderasi sengaja TERPISAH dari action milik user di
// src/features/question-comment/actions.ts. Action di sana memakai
// `requireOwnLiveComment()` yang menolak non-pemilik, dan guard itu tidak boleh
// dilonggarkan hanya supaya admin bisa memakainya kembali.
//
// Tidak ada invalidasi cache di sini: thread diskusi dan hitungannya memang
// tidak di-`unstable_cache` dan tidak punya tag di CACHE_TAGS.
//
// Catatan Cloudinary: takedown hanya mengubah record database. File gambar yang
// sudah diunggah tidak dihapus — pembersihan asset fisik di luar scope modul ini.

/**
 * Menarik satu root publik kembali menjadi privat. Isi tidak hilang, tetapi
 * berhenti tampil; balasan orang lain tetap ada di bawah tombstone-nya.
 *
 * Tidak ada kebalikannya. Mengembalikan root ke PUBLIC berarti admin
 * menerbitkan tulisan orang lain, dan keputusan membagikan catatan selalu milik
 * penulisnya.
 */
export async function hideDiscussionRootAction(input: HideDiscussionRootInput) {
  await requireAdmin();

  const validated = HideDiscussionRootSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const comment = await prisma.questionComment.findUnique({
    where: { id: validated.data.commentId },
    select: { id: true, parentId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) notFound();

  // Balasan mewarisi visibility root-nya dan tidak punya toggle sendiri; untuk
  // balasan yang bermasalah, yang tepat adalah takedown.
  if (comment.parentId !== null) {
    throw new Error("Hanya catatan utama yang dapat disembunyikan. Pakai takedown untuk balasan.");
  }

  await prisma.questionComment.update({
    where: { id: comment.id },
    data: { visibility: "PRIVATE" },
  });
}

/**
 * Takedown oleh admin. Selalu soft delete, tidak pernah menghapus baris —
 * balasan user lain menempel pada root, dan riwayatnya tetap dibutuhkan untuk
 * menilai pola penyalahgunaan.
 */
export async function takedownCommentAction(input: TakedownCommentInput) {
  const { user } = await requireAdmin();

  const validated = TakedownCommentSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const comment = await prisma.questionComment.findUnique({
    where: { id: validated.data.commentId },
    select: { id: true, deletedAt: true, sharedAt: true },
  });
  if (!comment) notFound();

  // Catatan yang tidak pernah dibagikan hanya terlihat pemiliknya, jadi tidak
  // ada yang perlu dimoderasi di sana.
  if (!comment.sharedAt) notFound();
  if (comment.deletedAt) return;

  await prisma.questionComment.update({
    where: { id: comment.id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });
}

/**
 * Membatalkan takedown admin. Hanya berlaku untuk entri yang dihapus admin:
 * memulihkan hapusan pemilik berarti menerbitkan ulang tulisan yang sengaja ia
 * tarik, dan itu bukan keputusan admin.
 */
export async function restoreCommentAction(input: RestoreCommentInput) {
  await requireAdmin();

  const validated = RestoreCommentSchema.safeParse(input);
  if (!validated.success) throw new Error("Data tidak valid.");

  const comment = await prisma.questionComment.findUnique({
    where: { id: validated.data.commentId },
    select: { id: true, userId: true, deletedAt: true, deletedById: true },
  });
  if (!comment || !comment.deletedAt) notFound();

  if (comment.deletedById === null || comment.deletedById === comment.userId) {
    throw new Error("Ini dihapus pemiliknya sendiri, bukan takedown admin. Tidak dapat dipulihkan.");
  }

  await prisma.questionComment.update({
    where: { id: comment.id },
    data: { deletedAt: null, deletedById: null },
  });
}
