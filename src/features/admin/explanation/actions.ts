"use server";

import { notFound } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { recordAdminActionTx } from "../audit";
import { CACHE_TAGS } from "@/constants/cache-key";
import {
  UpdateExplanationSchema,
  ApproveExplanationSchema,
  UnapproveExplanationSchema,
  ResolveAnswerKeyDoubtSchema,
  type UpdateExplanationInput,
  type ApproveExplanationInput,
  type UnapproveExplanationInput,
  type ResolveAnswerKeyDoubtInput,
} from "./schemas";

export type ExplanationActionResult = { ok: true } | { ok: false; message: string };

// Pembahasan ikut terkirim di mode baca, hasil attempt, dan latihan cepat, jadi
// cache paketnya perlu diperbarui. Mode ujian tidak pernah menerima pembahasan
// sama sekali — lihat aturan data-leak di docs/database.md.
async function revalidateForQuestion(questionId: number) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { testPackageItem: { select: { testPackageId: true } } },
  });
  if (!question) return;
  const packageId = question.testPackageItem.testPackageId;
  updateTag(CACHE_TAGS.testPackageQuestions(packageId));
  updateTag(CACHE_TAGS.testPackageDetail(packageId));
}

export async function updateExplanationAction(
  input: UpdateExplanationInput,
): Promise<ExplanationActionResult> {
  const actor = await requireAdmin();

  const validated = UpdateExplanationSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const data = validated.data;
  const question = await prisma.question.findUnique({
    where: { id: data.questionId },
    select: { id: true, questionAnswer: true, explanation: { select: { id: true } } },
  });
  if (!question) notFound();

  const keyPoints = data.keyPointsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filledChoices = data.choices.filter((choice) => choice.reason.trim().length > 0);
  // `isCorrect` didenormalisasi dari kunci jawaban soal saat menulis, persis
  // seperti yang dilakukan seed — supaya UI dapat merender alasan sejajar
  // dengan opsi tanpa join tambahan.
  const choiceRows = filledChoices.map((choice) => ({
    codeAnswer: choice.codeAnswer,
    isCorrect: choice.codeAnswer === question.questionAnswer,
    reason: choice.reason.trim(),
  }));

  await prisma.$transaction(async (tx) => {
    const explanation = await tx.questionExplanation.upsert({
      where: { questionId: data.questionId },
      update: {
        summary: data.summary,
        detail: data.detail,
        translation: data.translation,
        keyPoints,
        answerKeyDoubt: data.answerKeyDoubt,
        answerKeyDoubtNote: data.answerKeyDoubt ? data.answerKeyDoubtNote : null,
      },
      create: {
        questionId: data.questionId,
        summary: data.summary,
        detail: data.detail,
        translation: data.translation,
        keyPoints,
        answerKeyDoubt: data.answerKeyDoubt,
        answerKeyDoubtNote: data.answerKeyDoubt ? data.answerKeyDoubtNote : null,
        // Pembahasan yang lahir dari editor ini ditulis manusia sejak awal.
        // Yang sudah ada tidak diubah source-nya di sini: menyunting bukan
        // menyetujui, dan pergantian AI -> HUMAN terjadi saat approve.
        source: "HUMAN",
      },
      select: { id: true },
    });

    await tx.questionExplanationChoice.deleteMany({ where: { explanationId: explanation.id } });
    if (choiceRows.length > 0) {
      await tx.questionExplanationChoice.createMany({
        data: choiceRows.map((row) => ({ ...row, explanationId: explanation.id })),
      });
    }

    await recordAdminActionTx(tx, {
      actor,
      action: "explanation.update",
      targetType: "question",
      targetId: data.questionId,
      summary: `Menyunting pembahasan (${choiceRows.length} alasan pilihan, ${keyPoints.length} poin kunci).`,
    });
  });

  await revalidateForQuestion(data.questionId);
  return { ok: true };
}

/**
 * Menyetujui pembahasan: mengisi `reviewedAt` dan, bila sumbernya AI, menaikkan
 * `source` menjadi HUMAN. IMPORTED dibiarkan apa adanya karena itu provenance —
 * pembahasan dari buku resmi tetap berasal dari buku walaupun sudah ditinjau.
 */
export async function approveExplanationAction(
  input: ApproveExplanationInput,
): Promise<ExplanationActionResult> {
  const actor = await requireAdmin();

  const validated = ApproveExplanationSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const explanation = await prisma.questionExplanation.findUnique({
    where: { questionId: validated.data.questionId },
    select: { id: true, source: true, answerKeyDoubt: true },
  });
  if (!explanation) return { ok: false, message: "Soal ini belum punya pembahasan." };

  // Menyetujui pembahasan yang kunci jawabannya masih diragukan berarti
  // mengesahkan sesuatu yang belum diperiksa. Selesaikan dulu keraguannya.
  if (explanation.answerKeyDoubt) {
    return {
      ok: false,
      message:
        "Kunci jawaban masih ditandai meragukan. Periksa soalnya, lalu tandai keraguan selesai sebelum menyetujui.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.questionExplanation.update({
      where: { id: explanation.id },
      data: {
        reviewedAt: new Date(),
        ...(explanation.source === "AI" ? { source: "HUMAN" as const } : {}),
      },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "explanation.approve",
      targetType: "question",
      targetId: validated.data.questionId,
      summary:
        explanation.source === "AI"
          ? "Menyetujui pembahasan; source AI dinaikkan menjadi HUMAN."
          : `Menyetujui pembahasan bersumber ${explanation.source}.`,
    });
  });

  await revalidateForQuestion(validated.data.questionId);
  return { ok: true };
}

/** Membatalkan persetujuan. `source` tidak dikembalikan ke AI: teksnya sudah
 * pernah dilihat dan mungkin disunting manusia, dan itu tidak bisa dibatalkan. */
export async function unapproveExplanationAction(
  input: UnapproveExplanationInput,
): Promise<ExplanationActionResult> {
  const actor = await requireAdmin();

  const validated = UnapproveExplanationSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const explanation = await prisma.questionExplanation.findUnique({
    where: { questionId: validated.data.questionId },
    select: { id: true },
  });
  if (!explanation) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.questionExplanation.update({
      where: { id: explanation.id },
      data: { reviewedAt: null },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "explanation.unapprove",
      targetType: "question",
      targetId: validated.data.questionId,
      summary: "Membatalkan persetujuan pembahasan; source tidak dikembalikan ke AI.",
    });
  });

  await revalidateForQuestion(validated.data.questionId);
  return { ok: true };
}

/**
 * Menutup penandaan `answerKeyDoubt` setelah kunci jawaban diperiksa. Tidak
 * mengubah kunci jawabannya sendiri — itu dilakukan di editor soal, supaya
 * perubahan data soal tidak tersembunyi di dalam layar pembahasan.
 */
export async function resolveAnswerKeyDoubtAction(
  input: ResolveAnswerKeyDoubtInput,
): Promise<ExplanationActionResult> {
  const actor = await requireAdmin();

  const validated = ResolveAnswerKeyDoubtSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const explanation = await prisma.questionExplanation.findUnique({
    where: { questionId: validated.data.questionId },
    select: { id: true },
  });
  if (!explanation) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.questionExplanation.update({
      where: { id: explanation.id },
      data: { answerKeyDoubt: false, answerKeyDoubtNote: null },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "explanation.resolve_doubt",
      targetType: "question",
      targetId: validated.data.questionId,
      summary: "Menutup penanda kunci jawaban meragukan setelah diperiksa.",
    });
  });

  await revalidateForQuestion(validated.data.questionId);
  return { ok: true };
}
