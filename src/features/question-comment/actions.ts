"use server";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createSignedUploadParams } from "@/lib/cloudinary";
import {
  AddQuestionCommentSchema,
  EditQuestionCommentSchema,
  DeleteQuestionCommentSchema,
  type AddQuestionCommentInput,
  type EditQuestionCommentInput,
  type DeleteQuestionCommentInput,
} from "./schemas";

async function ensureQuestionExists(questionId: number) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) notFound();
}

export async function addQuestionCommentAction(input: AddQuestionCommentInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = AddQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { questionId, commentText, commentImages } = validated.data;
  await ensureQuestionExists(questionId);

  await prisma.questionComment.create({
    data: {
      questionId,
      userId: authSession.userId,
      commentText,
      commentImages,
    },
  });
}

export async function updateQuestionCommentAction(input: EditQuestionCommentInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = EditQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, commentText, commentImages } = validated.data;

  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });

  if (!comment || comment.userId !== authSession.userId) notFound();

  await prisma.questionComment.update({
    where: { id: commentId },
    data: { commentText, commentImages },
  });
}

export async function deleteQuestionCommentAction(input: DeleteQuestionCommentInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = DeleteQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId } = validated.data;

  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });

  if (!comment || comment.userId !== authSession.userId) notFound();

  await prisma.questionComment.delete({ where: { id: commentId } });
}

// Client uploads straight to Cloudinary with these signed params — our server
// never proxies the file itself, and CLOUDINARY_API_SECRET never reaches the client.
export async function getCommentImageUploadSignatureAction() {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  return createSignedUploadParams(`jlpt-exam/comments/${authSession.userId}`);
}
