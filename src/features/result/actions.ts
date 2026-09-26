"use server";

import { notFound, redirect } from "next/navigation";
import { unstable_cache, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import type { MondaiType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { QUESTION_EXPLANATION_SELECT } from "@/lib/question-explanation";
import { getSession } from "@/lib/auth";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { FEATURES } from "@/constants";
import { getQuestionDiscussionCounts } from "@/features/question-comment/queries";
import { readGuestExamCookie, GUEST_EXAM_COOKIE } from "@/features/exam/guest-cookie";
import { ExamAnswerSchema, type ExamAnswerInput } from "@/features/exam/schemas";
import {
  createGuestAttemptStash,
  consumeGuestAttemptStash,
} from "./lib/guest-attempt-stash";
import { computeJlptScoreProjection, type MondaiStatInput } from "@/lib/jlpt-score";

const GuestAttemptAnswersSchema = z.array(ExamAnswerSchema).max(500);

const getCachedAttemptSummary = (attemptId: number, userId: number) =>
  unstable_cache(
    async (id: number, ownerId: number) => {
      const attempt = await prisma.attempt.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          testPackageId: true,
          sectionScope: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          testPackage: { select: { id: true, name: true, jlptLevel: true } },
          answers: {
            select: {
              selectedAnswer: true,
              isCorrect: true,
              flagged: true,
              question: {
                select: { testPackageItem: { select: { mondaiType: true } } },
              },
            },
          },
        },
      });

      if (!attempt || attempt.userId !== ownerId) return null;

      return {
        ...attempt,
        startedAt: attempt.startedAt.toISOString(),
        finishedAt: attempt.finishedAt?.toISOString() ?? null,
      };
    },
    CACHE_KEYS.attemptSummary(attemptId),
    { tags: [CACHE_TAGS.attemptSummary(attemptId)] },
  )(attemptId, userId);

export async function getAttemptSummary(attemptId: number) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const attempt = await getCachedAttemptSummary(attemptId, authSession.userId);
  if (!attempt) notFound();
  if (attempt.status !== "COMPLETED") redirect(`/test-package/${attempt.testPackageId}`);

  const totalQuestions = attempt.answers.length;
  const totalCorrect = attempt.answers.filter((a) => a.isCorrect).length;
  const totalUnanswered = attempt.answers.filter((a) => a.selectedAnswer === null).length;
  const totalWrong = totalQuestions - totalCorrect - totalUnanswered;
  const totalFlagged = attempt.answers.filter((a) => a.flagged).length;
  const scorePercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const byMondaiType = new Map<MondaiType, { correct: number; total: number }>();

  for (const answer of attempt.answers) {
    const { mondaiType } = answer.question.testPackageItem;
    const stat = byMondaiType.get(mondaiType) ?? { correct: 0, total: 0 };
    stat.total += 1;
    if (answer.isCorrect) stat.correct += 1;
    byMondaiType.set(mondaiType, stat);
  }

  const mondaiStats: MondaiStatInput[] = Array.from(byMondaiType, ([mondaiType, stat]) => ({
    mondaiType,
    ...stat,
  }));

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      sectionScope: attempt.sectionScope,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      testPackage: attempt.testPackage,
    },
    stats: { totalQuestions, totalCorrect, totalWrong, totalUnanswered, totalFlagged, scorePercentage },
    mondaiStats,
  };
}

/**
 * Ringkasan hasil untuk guest.
 *
 * Guest tidak membuat row `Attempt`, jadi lembar jawabannya dikirim client dari
 * `sessionStorage`. Penilaian tetap dikerjakan server karena `questionAnswer`
 * sengaja tidak pernah ikut ke client selama exam berlangsung.
 *
 * Mengembalikan `null` — bukan `notFound()` — ketika cookie guest sudah habis,
 * supaya halaman hasil bisa menampilkan empty state yang menjelaskan bahwa
 * hasil guest memang tidak disimpan.
 */
export async function getGuestAttemptSummary(answers: ExamAnswerInput[]) {
  const validated = GuestAttemptAnswersSchema.safeParse(answers);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const guestData = await readGuestExamCookie();
  if (!guestData) return null;

  const testPackage = await prisma.testPackage.findUnique({
    where: { id: guestData.testPackageId },
    select: { id: true, name: true, jlptLevel: true },
  });
  if (!testPackage) return null;

  // Penyebut diambil dari seluruh soal pada scope, bukan dari payload client:
  // session yang dilewati guest tetap terhitung sebagai kosong.
  const testPackageItems = await prisma.testPackageItem.findMany({
    where: guestData.sectionScope
      ? { testPackageId: guestData.testPackageId, section: guestData.sectionScope }
      : { testPackageId: guestData.testPackageId },
    select: {
      mondaiType: true,
      questions: { select: { id: true, questionAnswer: true } },
    },
  });

  const submitted = new Map(validated.data.map((answer) => [answer.questionId, answer]));
  const byMondaiType = new Map<MondaiType, { correct: number; total: number }>();

  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalUnanswered = 0;
  let totalFlagged = 0;

  for (const item of testPackageItems) {
    const stat = byMondaiType.get(item.mondaiType) ?? { correct: 0, total: 0 };

    for (const question of item.questions) {
      const answer = submitted.get(question.id);
      totalQuestions += 1;
      stat.total += 1;

      if (answer?.flagged) totalFlagged += 1;

      if (!answer || answer.selectedAnswer === null) {
        totalUnanswered += 1;
      } else if (answer.selectedAnswer === question.questionAnswer) {
        totalCorrect += 1;
        stat.correct += 1;
      }
    }

    byMondaiType.set(item.mondaiType, stat);
  }

  const mondaiStats: MondaiStatInput[] = Array.from(byMondaiType, ([mondaiType, stat]) => ({
    mondaiType,
    ...stat,
  }));

  return {
    testPackage,
    sectionScope: guestData.sectionScope,
    stats: {
      totalQuestions,
      totalCorrect,
      totalWrong: totalQuestions - totalCorrect - totalUnanswered,
      totalUnanswered,
      totalFlagged,
      scorePercentage:
        totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    },
    projection: computeJlptScoreProjection(mondaiStats),
  };
}

/**
 * Menitipkan lembar jawaban guest sebelum ia masuk ke alur login/register.
 *
 * Dipanggil saat guest menekan CTA simpan, bukan setelah auth selesai:
 * `sessionStorage` terikat satu tab, sedangkan jalur register baru membuat
 * session setelah tautan verifikasi email diklik — biasanya di tab baru.
 */
export async function stashGuestAttemptAction(answers: ExamAnswerInput[]) {
  const validated = GuestAttemptAnswersSchema.safeParse(answers);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const guestData = await readGuestExamCookie();
  if (!guestData) return { ok: false as const };

  await createGuestAttemptStash({
    testPackageId: guestData.testPackageId,
    sectionScope: guestData.sectionScope,
    startedAt: guestData.startedAt ?? null,
    answers: validated.data,
  });

  return { ok: true as const };
}

/**
 * Mengklaim titipan tadi menjadi `Attempt` milik user yang baru masuk.
 *
 * `isCorrect` dihitung ulang dari kunci jawaban seperti submit biasa, jadi skor
 * tidak bisa dikarang client — yang bisa dikarang hanya pilihan jawabannya, dan
 * itu hanya mengotori statistik miliknya sendiri.
 */
export async function importGuestAttemptAction() {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const stash = await consumeGuestAttemptStash();
  if (!stash) return { ok: false as const, reason: "expired" as const };

  const scopedWhere = stash.sectionScope
    ? { testPackageId: stash.testPackageId, section: stash.sectionScope }
    : { testPackageId: stash.testPackageId };

  const testPackageItems = await prisma.testPackageItem.findMany({
    where: scopedWhere,
    select: { questions: { select: { id: true, questionAnswer: true } } },
  });

  const answerKey = new Map<number, number>();
  for (const item of testPackageItems) {
    for (const question of item.questions) {
      answerKey.set(question.id, question.questionAnswer);
    }
  }
  if (answerKey.size === 0) return { ok: false as const, reason: "expired" as const };

  const submitted = new Map(stash.answers.map((answer) => [answer.questionId, answer]));

  // Satu row per soal pada scope — bukan hanya yang dikirim client — supaya
  // penyebut attempt hasil impor sama dengan yang dilihat guest di ringkasan.
  const finishedAt = new Date();
  const startedAt = stash.startedAt ? new Date(stash.startedAt) : finishedAt;

  const attempt = await prisma.attempt.create({
    data: {
      userId: authSession.userId,
      testPackageId: stash.testPackageId,
      sectionScope: stash.sectionScope,
      status: "COMPLETED",
      startedAt,
      finishedAt,
      answers: {
        createMany: {
          data: Array.from(answerKey, ([questionId, correctAnswer]) => {
            const answer = submitted.get(questionId);
            return {
              questionId,
              selectedAnswer: answer?.selectedAnswer ?? null,
              isCorrect:
                answer?.selectedAnswer != null && answer.selectedAnswer === correctAnswer,
              flagged: answer?.flagged ?? false,
            };
          }),
        },
      },
    },
    select: { id: true },
  });

  // Cookie exam guest ikut dibuang: lembar jawabannya sudah punya rumah tetap.
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_EXAM_COOKIE);

  updateTag(CACHE_TAGS.dashboardSummary(authSession.userId));
  updateTag(CACHE_TAGS.analytics(authSession.userId));
  updateTag(CACHE_TAGS.profileOverview(authSession.userId));

  return { ok: true as const, attemptId: attempt.id };
}

// Not cached: includes per-user QuestionComment which must reflect new
// comments immediately (read-your-own-writes) right after submitting one.
export async function getAttemptDetail(attemptId: number) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      testPackageId: true,
      sectionScope: true,
      status: true,
      testPackage: { select: { id: true, name: true, jlptLevel: true } },
    },
  });

  if (!attempt || attempt.userId !== authSession.userId) notFound();
  if (attempt.status !== "COMPLETED") redirect(`/test-package/${attempt.testPackageId}`);

  const testPackageItems = await prisma.testPackageItem.findMany({
    where: attempt.sectionScope
      ? { testPackageId: attempt.testPackageId, section: attempt.sectionScope }
      : { testPackageId: attempt.testPackageId },
    orderBy: [{ session: "asc" }, { order: "asc" }],
    select: {
      id: true,
      mondaiType: true,
      section: true,
      session: true,
      order: true,
      instruction: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          questionText: true,
          questionImage: true,
          questionAudio: true,
          questionAnswer: true,
          explanation: { select: QUESTION_EXPLANATION_SELECT },
          questionContext: {
            select: { id: true, storyText: true, storyImage: true, storyAudio: true },
          },
          questionChoices: {
            orderBy: { codeAnswer: "asc" },
            select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
          },
          questionComments: {
            // Catatan pribadi milik user ini saja. Balasan pada thread publik
            // (`parentId != null`) tidak ikut karena tempatnya di dalam thread.
            where: { userId: authSession.userId, parentId: null, deletedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              commentText: true,
              commentImages: true,
              visibility: true,
              createdAt: true,
              updatedAt: true,
              user: { select: { displayName: true } },
            },
          },
          attemptAnswers: {
            where: { attemptId },
            select: { selectedAnswer: true, isCorrect: true, flagged: true },
          },
        },
      },
    },
  });

  const discussionCounts = FEATURES.questionDiscussion
    ? await getQuestionDiscussionCounts(
        testPackageItems.flatMap((item) => item.questions.map((question) => question.id)),
      )
    : new Map<number, number>();

  return {
    attempt,
    testPackageItems: testPackageItems.map((item) => ({
      ...item,
      questions: item.questions.map((question) => ({
        ...question,
        discussionCount: discussionCounts.get(question.id) ?? 0,
      })),
    })),
  };
}
