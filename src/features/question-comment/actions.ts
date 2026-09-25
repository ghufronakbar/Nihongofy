"use server";

import { notFound, redirect } from "next/navigation";
import { FEATURES } from "@/constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createSignedUploadParams } from "@/lib/cloudinary";
import { getQuestionDiscussion, type DiscussionRoot } from "./queries";
import {
  AddQuestionCommentSchema,
  EditQuestionCommentSchema,
  DeleteQuestionCommentSchema,
  ReplyQuestionCommentSchema,
  SetQuestionCommentVisibilitySchema,
  GetQuestionDiscussionSchema,
  type AddQuestionCommentInput,
  type EditQuestionCommentInput,
  type DeleteQuestionCommentInput,
  type ReplyQuestionCommentInput,
  type SetQuestionCommentVisibilityInput,
  type GetQuestionDiscussionInput,
} from "./schemas";

async function ensureQuestionExists(questionId: number) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) notFound();
}

// Comment yang sudah di-soft delete diperlakukan seperti tidak ada: hanya
// tombstone-nya yang dirender, dan tidak boleh diedit, dibagikan, atau dibalas.
async function requireOwnLiveComment(commentId: number, userId: number) {
  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, parentId: true, deletedAt: true, sharedAt: true },
  });

  if (!comment || comment.userId !== userId || comment.deletedAt) notFound();
  return comment;
}

export async function addQuestionCommentAction(input: AddQuestionCommentInput) {
  if (!FEATURES.questionComment) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = AddQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { questionId, commentText, commentImages, visibility } = validated.data;
  if (visibility === "PUBLIC" && !FEATURES.questionDiscussion) notFound();

  await ensureQuestionExists(questionId);

  await prisma.questionComment.create({
    data: {
      questionId,
      userId: authSession.userId,
      commentText,
      commentImages,
      visibility,
      sharedAt: visibility === "PUBLIC" ? new Date() : null,
    },
  });
}

export async function updateQuestionCommentAction(input: EditQuestionCommentInput) {
  if (!FEATURES.questionComment) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = EditQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, commentText, commentImages } = validated.data;
  await requireOwnLiveComment(commentId, authSession.userId);

  await prisma.questionComment.update({
    where: { id: commentId },
    data: { commentText, commentImages },
  });
}

// Selalu soft delete, tidak pernah menghapus baris. Balasan user lain menempel
// pada root ini; menghapusnya secara fisik akan ikut memusnahkan percakapan
// mereka. Baris yang tertinggal juga menjadi bahan dashboard admin nanti.
export async function deleteQuestionCommentAction(input: DeleteQuestionCommentInput) {
  if (!FEATURES.questionComment) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = DeleteQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId } = validated.data;
  await requireOwnLiveComment(commentId, authSession.userId);

  await prisma.questionComment.update({
    where: { id: commentId },
    // deletedById dicatat supaya moderasi dapat membedakan hapusan pemilik dari
    // takedown admin. Hanya takedown admin yang boleh dipulihkan.
    data: { deletedAt: new Date(), deletedById: authSession.userId },
  });
}

// ============================================================
// DISKUSI PUBLIK
// ============================================================

export async function setQuestionCommentVisibilityAction(
  input: SetQuestionCommentVisibilityInput,
) {
  if (!FEATURES.questionDiscussion) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = SetQuestionCommentVisibilitySchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, visibility } = validated.data;
  const comment = await requireOwnLiveComment(commentId, authSession.userId);

  // Balasan mewarisi visibility root-nya dan tidak punya toggle sendiri.
  if (comment.parentId) notFound();

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
}

export async function replyToQuestionCommentAction(input: ReplyQuestionCommentInput) {
  if (!FEATURES.questionDiscussion) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = ReplyQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { parentId, commentText, commentImages } = validated.data;

  const target = await prisma.questionComment.findUnique({
    where: { id: parentId },
    select: { id: true, questionId: true, parentId: true },
  });
  if (!target) notFound();

  // Balasan hanya satu tingkat: membalas sebuah balasan berarti menambah
  // balasan baru pada root yang sama, bukan membuat cabang baru.
  const rootId = target.parentId ?? target.id;

  const root = await prisma.questionComment.findUnique({
    where: { id: rootId },
    select: { id: true, questionId: true, visibility: true, deletedAt: true, sharedAt: true },
  });

  // Thread yang sudah disembunyikan atau dihapus menjadi arsip read-only.
  if (!root || root.deletedAt || root.visibility !== "PUBLIC" || !root.sharedAt) {
    notFound();
  }

  await prisma.questionComment.create({
    data: {
      questionId: root.questionId,
      userId: authSession.userId,
      parentId: root.id,
      commentText,
      commentImages,
      // Balasan ikut visibility root; tidak pernah menjadi catatan pribadi.
      visibility: "PUBLIC",
      sharedAt: new Date(),
    },
  });
}

export async function getQuestionDiscussionAction(
  input: GetQuestionDiscussionInput,
): Promise<DiscussionRoot[]> {
  if (!FEATURES.questionDiscussion) notFound();

  const validated = GetQuestionDiscussionSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  // Diskusi publik terbuka untuk guest; login hanya dibutuhkan untuk menulis.
  return getQuestionDiscussion(validated.data.questionId);
}

// Client uploads straight to Cloudinary with these signed params — our server
// never proxies the file itself, and CLOUDINARY_API_SECRET never reaches the client.
export async function getCommentImageUploadSignatureAction() {
  if (!FEATURES.questionComment) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  return createSignedUploadParams(`jlpt-exam/comments/${authSession.userId}`);
}
