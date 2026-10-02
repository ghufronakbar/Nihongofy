"use server";

import { notFound, redirect } from "next/navigation";
import { COMMENT_IMAGE_UPLOAD_RATE_LIMITS, COMMENT_WRITE_RATE_LIMITS, FEATURES } from "@/constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createCommentImageUpload, isAllowedCommentImageUrl } from "@/lib/r2";
import { formatRetryAfter } from "@/lib/rate-limit";
import { limitByRedis } from "@/lib/redis-rate-limit";
import { getDiscussion, getOwnVocabNotes, type DiscussionRoot, type OwnNote } from "./queries";
import {
  AddQuestionCommentSchema,
  EditQuestionCommentSchema,
  DeleteQuestionCommentSchema,
  ReplyQuestionCommentSchema,
  SetQuestionCommentVisibilitySchema,
  GetDiscussionSchema,
  GetOwnVocabNotesSchema,
  CreateCommentImageUploadSchema,
  type AddQuestionCommentInput,
  type EditQuestionCommentInput,
  type DeleteQuestionCommentInput,
  type ReplyQuestionCommentInput,
  type SetQuestionCommentVisibilityInput,
  type GetDiscussionInput,
  type GetOwnVocabNotesInput,
  type CreateCommentImageUploadInput,
} from "./schemas";
import { targetColumns, targetOf, type CommentTarget } from "./target";

/**
 * Hasil aksi tulis. Penolakan yang perlu dibaca user (rate limit) dikembalikan
 * sebagai pesan, bukan dilempar: pesan error Server Action disamarkan di
 * produksi. Input tidak valid dan akses terlarang tetap `notFound()`/throw.
 */
export type CommentActionResult = { ok: true } | { ok: false; message: string };

// ============================================================
// FLAG PER TARGET
// ============================================================

// Catatan dan diskusi soal punya dua flag; untuk kata flashcard dan pola
// bunpou keduanya menumpang satu flag per modul (`FEATURES_FLASHCARD_DISCUSSION`,
// `FEATURES_BUNPOU_DISCUSSION`).
function notesEnabled(target: CommentTarget) {
  switch (target.type) {
    case "question":
      return FEATURES.questionComment;
    case "vocab":
      return FEATURES.flashcardDiscussion;
    case "bunpou":
      return FEATURES.bunpouDiscussion;
  }
}

function discussionEnabled(target: CommentTarget) {
  switch (target.type) {
    case "question":
      return FEATURES.questionDiscussion;
    case "vocab":
      return FEATURES.flashcardDiscussion;
    case "bunpou":
      return FEATURES.bunpouDiscussion;
  }
}

// ============================================================
// PENJAGA BERSAMA
// ============================================================

// Gambar komentar disimpan sebagai URL biasa, jadi tanpa cek ini user bisa
// menyimpan URL bucket milik orang lain atau host sembarang ke dalam komentarnya.
// URL Cloudinary lama tetap lolos supaya komentar sebelum migrasi masih bisa disunting.
function requireOwnedCommentImages(commentImages: string[], userId: number) {
  if (!commentImages.every((url) => isAllowedCommentImageUrl(url, userId))) {
    throw new Error("Gambar komentar tidak valid.");
  }
}

// Kata dan pola yang sudah pensiun dari katalog tetap menyimpan catatan lamanya,
// tetapi tidak menerima catatan baru.
async function ensureTargetExists(target: CommentTarget) {
  switch (target.type) {
    case "question": {
      const question = await prisma.question.findUnique({
        where: { id: target.questionId },
        select: { id: true },
      });
      if (!question) notFound();
      return;
    }
    case "vocab": {
      const vocab = await prisma.flashcardVocab.findUnique({
        where: { id: target.vocabId },
        select: { retiredAt: true },
      });
      if (!vocab || vocab.retiredAt) notFound();
      return;
    }
    case "bunpou": {
      const point = await prisma.bunpouPoint.findUnique({
        where: { id: target.bunpouPointId },
        select: { retiredAt: true },
      });
      if (!point || point.retiredAt) notFound();
      return;
    }
  }
}

const commentTargetSelect = { questionId: true, vocabId: true, bunpouPointId: true } as const;

// Comment yang sudah di-soft delete diperlakukan seperti tidak ada: hanya
// tombstone-nya yang dirender, dan tidak boleh diedit, dibagikan, atau dibalas.
async function requireOwnLiveComment(commentId: number, userId: number) {
  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      parentId: true,
      deletedAt: true,
      sharedAt: true,
      ...commentTargetSelect,
    },
  });

  if (!comment || comment.userId !== userId || comment.deletedAt) notFound();
  const target = targetOf(comment);
  if (!target) notFound();
  return { ...comment, target };
}

// Satu kuota untuk semua tulisan (buat, balas, sunting, bagikan) di soal maupun
// flashcard: yang dicegah adalah satu akun membanjiri diskusi.
async function checkWriteLimit(userId: number): Promise<CommentActionResult | null> {
  const limit = await limitByRedis("comment-write", userId, COMMENT_WRITE_RATE_LIMITS);
  if (limit.allowed) return null;
  return {
    ok: false,
    message: `Terlalu banyak catatan dalam waktu singkat. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
  };
}

// ============================================================
// CATATAN
// ============================================================

export async function addQuestionCommentAction(
  input: AddQuestionCommentInput,
): Promise<CommentActionResult> {
  const validated = AddQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { target, commentText, commentImages, visibility } = validated.data;
  if (!notesEnabled(target)) notFound();
  if (visibility === "PUBLIC" && !discussionEnabled(target)) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  requireOwnedCommentImages(commentImages, authSession.userId);
  await ensureTargetExists(target);

  const limited = await checkWriteLimit(authSession.userId);
  if (limited) return limited;

  await prisma.questionComment.create({
    data: {
      ...targetColumns(target),
      userId: authSession.userId,
      commentText,
      commentImages,
      visibility,
      sharedAt: visibility === "PUBLIC" ? new Date() : null,
    },
  });
  return { ok: true };
}

export async function updateQuestionCommentAction(
  input: EditQuestionCommentInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = EditQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, commentText, commentImages } = validated.data;
  requireOwnedCommentImages(commentImages, authSession.userId);
  const comment = await requireOwnLiveComment(commentId, authSession.userId);
  if (!notesEnabled(comment.target)) notFound();

  const limited = await checkWriteLimit(authSession.userId);
  if (limited) return limited;

  await prisma.questionComment.update({
    where: { id: commentId },
    data: { commentText, commentImages },
  });
  return { ok: true };
}

// Selalu soft delete, tidak pernah menghapus baris. Balasan user lain menempel
// pada root ini; menghapusnya secara fisik akan ikut memusnahkan percakapan
// mereka. Baris yang tertinggal juga menjadi bahan moderasi admin. Tidak dibatasi
// rate limit: menarik tulisan sendiri tidak boleh terhalang kuota.
export async function deleteQuestionCommentAction(
  input: DeleteQuestionCommentInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = DeleteQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId } = validated.data;
  const comment = await requireOwnLiveComment(commentId, authSession.userId);
  if (!notesEnabled(comment.target)) notFound();

  await prisma.questionComment.update({
    where: { id: commentId },
    // deletedById dicatat supaya moderasi dapat membedakan hapusan pemilik dari
    // takedown admin. Hanya takedown admin yang boleh dipulihkan.
    data: { deletedAt: new Date(), deletedById: authSession.userId },
  });
  return { ok: true };
}

/** Catatan user pada satu kata; dipakai reviewer setelah catatannya berubah. */
export async function getOwnVocabNotesAction(input: GetOwnVocabNotesInput): Promise<OwnNote[]> {
  if (!FEATURES.flashcardDiscussion) notFound();

  const authSession = await getSession();
  if (!authSession) return [];

  const validated = GetOwnVocabNotesSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const notes = await getOwnVocabNotes(authSession.userId, [validated.data.vocabId]);
  return notes.get(validated.data.vocabId) ?? [];
}

// ============================================================
// DISKUSI PUBLIK
// ============================================================

export async function setQuestionCommentVisibilityAction(
  input: SetQuestionCommentVisibilityInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = SetQuestionCommentVisibilitySchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, visibility } = validated.data;
  const comment = await requireOwnLiveComment(commentId, authSession.userId);
  if (!discussionEnabled(comment.target)) notFound();

  // Balasan mewarisi visibility root-nya dan tidak punya toggle sendiri.
  if (comment.parentId) notFound();

  // Hanya membagikan yang dibatasi: menarik kembali ke privat harus selalu bisa.
  if (visibility === "PUBLIC") {
    const limited = await checkWriteLimit(authSession.userId);
    if (limited) return limited;
  }

  await prisma.questionComment.update({
    where: { id: commentId },
    data: {
      visibility,
      // `sharedAt` mencatat kapan catatan ini pertama kali masuk thread publik
      // dan tidak pernah dikosongkan lagi, supaya root yang dikembalikan ke
      // privat tetap tampil sebagai tombstone di atas balasan yang sudah ada.
      ...(visibility === "PUBLIC" && !comment.sharedAt ? { sharedAt: new Date() } : {}),
    },
  });
  return { ok: true };
}

export async function replyToQuestionCommentAction(
  input: ReplyQuestionCommentInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = ReplyQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { parentId, repliedToId, commentText, commentImages } = validated.data;
  requireOwnedCommentImages(commentImages, authSession.userId);

  const parent = await prisma.questionComment.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) notFound();

  // Balasan hanya satu tingkat: membalas sebuah balasan berarti menambah
  // balasan baru pada root yang sama, bukan membuat cabang baru.
  const rootId = parent.parentId ?? parent.id;

  const root = await prisma.questionComment.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      visibility: true,
      deletedAt: true,
      sharedAt: true,
      ...commentTargetSelect,
    },
  });

  // Thread yang sudah disembunyikan atau dihapus menjadi arsip read-only.
  if (!root || root.deletedAt || root.visibility !== "PUBLIC" || !root.sharedAt) {
    notFound();
  }
  const target = targetOf(root);
  if (!target || !discussionEnabled(target)) notFound();

  // Mention hanya diterima bila menunjuk comment hidup di thread yang sama.
  // Tanpa cek ini, balasan bisa "membalas" comment di soal lain dan merender
  // username orang yang tidak pernah ikut percakapan ini.
  let mentionId: number | null = null;
  if (repliedToId !== null) {
    const mentionTarget = await prisma.questionComment.findUnique({
      where: { id: repliedToId },
      select: { id: true, parentId: true, deletedAt: true },
    });
    const mentionRootId = mentionTarget?.parentId ?? mentionTarget?.id;
    if (mentionTarget && !mentionTarget.deletedAt && mentionRootId === root.id) {
      mentionId = mentionTarget.id;
    }
  }

  const limited = await checkWriteLimit(authSession.userId);
  if (limited) return limited;

  await prisma.questionComment.create({
    data: {
      // Balasan mewarisi target root, sehingga thread tidak pernah bercampur.
      questionId: root.questionId,
      vocabId: root.vocabId,
      bunpouPointId: root.bunpouPointId,
      userId: authSession.userId,
      parentId: root.id,
      repliedToId: mentionId,
      commentText,
      commentImages,
      // Balasan ikut visibility root; tidak pernah menjadi catatan pribadi.
      visibility: "PUBLIC",
      sharedAt: new Date(),
    },
  });
  return { ok: true };
}

export async function getDiscussionAction(input: GetDiscussionInput): Promise<DiscussionRoot[]> {
  const validated = GetDiscussionSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }
  if (!discussionEnabled(validated.data.target)) notFound();

  // Diskusi publik terbuka untuk guest; login hanya dibutuhkan untuk menulis.
  return getDiscussion(validated.data.target);
}

// ============================================================
// UPLOAD GAMBAR
// ============================================================

export type CommentImageUploadResult =
  | { ok: true; uploadUrl: string; url: string; contentType: string }
  | { ok: false; message: string };

// Browser meng-PUT langsung ke R2 dengan presigned URL ini; server tidak pernah
// memproksikan file dan R2_SECRET_ACCESS_KEY tidak pernah sampai ke client.
// Content-type dan ukuran ikut ditandatangani, jadi R2 sendiri yang menolak
// upload di luar batas.
export async function createCommentImageUploadAction(
  input: CreateCommentImageUploadInput,
): Promise<CommentImageUploadResult> {
  if (!FEATURES.questionComment && !FEATURES.flashcardDiscussion) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = CreateCommentImageUploadSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Permintaan upload tidak valid.",
    };
  }

  const limit = await limitByRedis(
    "comment-image-upload",
    authSession.userId,
    COMMENT_IMAGE_UPLOAD_RATE_LIMITS,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Terlalu banyak gambar diunggah. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }

  const upload = await createCommentImageUpload({
    userId: authSession.userId,
    contentType: validated.data.contentType,
    byteLength: validated.data.byteLength,
  });
  return { ok: true, ...upload };
}
