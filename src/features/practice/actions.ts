"use server";

import { unstable_cache, updateTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { JlptLevel, JlptSection, MondaiType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import {
  PRACTICE_LEVELS,
  PracticeConfigurationSchema,
  PracticeSessionIdSchema,
  SubmitPracticeAnswerSchema,
  type PracticeConfigurationInput,
  type PracticeSessionIdInput,
  type SubmitPracticeAnswerInput,
} from "./schemas";

export type PracticeCatalogEntry = {
  jlptLevel: JlptLevel;
  section: JlptSection;
  mondaiType: MondaiType;
  questionCount: number;
};

const getCachedPracticeCatalog = unstable_cache(
  async (): Promise<PracticeCatalogEntry[]> => {
    const rows = await prisma.testPackageItem.findMany({
      where: { questions: { some: { questionChoices: { some: {} } } } },
      select: {
        section: true,
        mondaiType: true,
        testPackage: { select: { jlptLevel: true } },
        _count: {
          select: { questions: { where: { questionChoices: { some: {} } } } },
        },
      },
    });

    const totals = new Map<string, PracticeCatalogEntry>();
    for (const row of rows) {
      const key = `${row.testPackage.jlptLevel}:${row.section}:${row.mondaiType}`;
      const current = totals.get(key);
      totals.set(key, {
        jlptLevel: row.testPackage.jlptLevel,
        section: row.section,
        mondaiType: row.mondaiType,
        questionCount: (current?.questionCount ?? 0) + row._count.questions,
      });
    }

    return Array.from(totals.values()).sort((a, b) => {
      const levelOrder = PRACTICE_LEVELS.indexOf(a.jlptLevel) - PRACTICE_LEVELS.indexOf(b.jlptLevel);
      if (levelOrder !== 0) return levelOrder;
      return `${a.section}:${a.mondaiType}`.localeCompare(`${b.section}:${b.mondaiType}`);
    });
  },
  CACHE_KEYS.practiceCatalog,
  { tags: [CACHE_TAGS.practiceCatalog, CACHE_TAGS.testPackageList] },
);

export async function getPracticeCatalog() {
  const authSession = await getSession();
  if (!authSession) redirect("/login?next=/exercises");

  return getCachedPracticeCatalog();
}

function seededShuffle<T>(values: T[], seed: number): T[] {
  const shuffled = [...values];
  let state = seed >>> 0;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function practiceQuestionWhere(
  input: PracticeConfigurationInput,
): Prisma.QuestionWhereInput {
  return {
    questionChoices: { some: {} },
    testPackageItem: {
      section: input.section,
      mondaiType: input.mondaiType,
      testPackage: { jlptLevel: input.jlptLevel },
    },
  };
}

export async function createPracticeSessionAction(input: PracticeConfigurationInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login?next=/exercises");

  const validated = PracticeConfigurationSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false as const, message: "Konfigurasi latihan tidak valid." };
  }

  const candidates = await prisma.question.findMany({
    where: practiceQuestionWhere(validated.data),
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (candidates.length < validated.data.questionCount) {
    return {
      ok: false as const,
      message: "Jumlah soal yang dipilih sudah tidak tersedia. Muat ulang lalu coba lagi.",
    };
  }

  const sessionId = await prisma.$transaction(async (tx) => {
    const practiceSession = await tx.practiceSession.create({
      data: {
        userId: authSession.userId,
        jlptLevel: validated.data.jlptLevel,
        section: validated.data.section,
        mondaiType: validated.data.mondaiType,
        questionCount: validated.data.questionCount,
      },
      select: { id: true },
    });

    const selected = seededShuffle(
      candidates,
      practiceSession.id * 2654435761 + authSession.userId,
    ).slice(0, validated.data.questionCount);

    await tx.practiceAnswer.createMany({
      data: selected.map((question, index) => ({
        practiceSessionId: practiceSession.id,
        questionId: question.id,
        order: index + 1,
      })),
    });

    return practiceSession.id;
  });

  redirect(`/exercises/${sessionId}`);
}

export async function getPracticeSession(input: PracticeSessionIdInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = PracticeSessionIdSchema.safeParse(input);
  if (!validated.success) notFound();

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: validated.data.sessionId },
    select: {
      id: true,
      userId: true,
      jlptLevel: true,
      section: true,
      mondaiType: true,
      questionCount: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      answers: {
        orderBy: { order: "asc" },
        select: {
          questionId: true,
          order: true,
          selectedAnswer: true,
          isCorrect: true,
          answeredAt: true,
          question: {
            select: {
              id: true,
              order: true,
              questionText: true,
              questionImage: true,
              questionAudio: true,
              questionChoices: {
                orderBy: { codeAnswer: "asc" },
                select: {
                  id: true,
                  codeAnswer: true,
                  answerText: true,
                  answerImage: true,
                },
              },
              questionContext: {
                select: {
                  id: true,
                  storyText: true,
                  storyImage: true,
                  storyAudio: true,
                },
              },
              testPackageItem: {
                select: {
                  instruction: true,
                  mondaiType: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!practiceSession || practiceSession.userId !== authSession.userId) notFound();

  const answeredQuestionIds = practiceSession.answers
    .filter((answer) => answer.answeredAt !== null)
    .map((answer) => answer.questionId);

  const answeredKeys = answeredQuestionIds.length
    ? await prisma.question.findMany({
        where: { id: { in: answeredQuestionIds } },
        select: { id: true, questionAnswer: true, explanation: true },
      })
    : [];
  const feedbackByQuestion = new Map(answeredKeys.map((question) => [question.id, question]));

  return {
    id: practiceSession.id,
    jlptLevel: practiceSession.jlptLevel,
    section: practiceSession.section,
    mondaiType: practiceSession.mondaiType,
    questionCount: practiceSession.questionCount,
    status: practiceSession.status,
    startedAt: practiceSession.startedAt.toISOString(),
    finishedAt: practiceSession.finishedAt?.toISOString() ?? null,
    questions: practiceSession.answers.map((answer) => {
      const feedback = feedbackByQuestion.get(answer.questionId);
      return {
        assignmentOrder: answer.order,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
        answeredAt: answer.answeredAt?.toISOString() ?? null,
        feedback: feedback
          ? {
              correctAnswer: feedback.questionAnswer,
              explanation: feedback.explanation,
            }
          : null,
        ...answer.question,
      };
    }),
  };
}

export async function submitPracticeAnswerAction(input: SubmitPracticeAnswerInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = SubmitPracticeAnswerSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false as const, message: "Jawaban yang dikirim tidak valid." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.practiceAnswer.findUnique({
      where: {
        practiceSessionId_questionId: {
          practiceSessionId: validated.data.sessionId,
          questionId: validated.data.questionId,
        },
      },
      select: {
        id: true,
        selectedAnswer: true,
        isCorrect: true,
        answeredAt: true,
        practiceSession: {
          select: { id: true, userId: true, status: true, questionCount: true },
        },
        question: {
          select: {
            questionAnswer: true,
            explanation: true,
            questionChoices: { select: { codeAnswer: true } },
          },
        },
      },
    });

    if (!assignment || assignment.practiceSession.userId !== authSession.userId) notFound();

    const selectedAnswerIsValid = assignment.question.questionChoices.some(
      (choice) => choice.codeAnswer === validated.data.selectedAnswer,
    );
    if (!selectedAnswerIsValid) {
      return { ok: false as const, message: "Pilihan jawaban tidak tersedia untuk soal ini." };
    }

    if (!assignment.answeredAt && assignment.practiceSession.status !== "IN_PROGRESS") {
      return { ok: false as const, message: "Sesi latihan ini sudah ditutup." };
    }

    if (!assignment.answeredAt) {
      const now = new Date();
      await tx.practiceAnswer.updateMany({
        where: { id: assignment.id, answeredAt: null },
        data: {
          selectedAnswer: validated.data.selectedAnswer,
          isCorrect: validated.data.selectedAnswer === assignment.question.questionAnswer,
          answeredAt: now,
        },
      });
    }

    const answeredCount = await tx.practiceAnswer.count({
      where: { practiceSessionId: assignment.practiceSession.id, answeredAt: { not: null } },
    });
    const correctCount = await tx.practiceAnswer.count({
      where: { practiceSessionId: assignment.practiceSession.id, isCorrect: true },
    });
    const isComplete = answeredCount >= assignment.practiceSession.questionCount;

    if (isComplete && assignment.practiceSession.status === "IN_PROGRESS") {
      await tx.practiceSession.update({
        where: { id: assignment.practiceSession.id },
        data: { status: "COMPLETED", finishedAt: new Date() },
      });
    }

    const persisted = assignment.answeredAt
      ? assignment
      : await tx.practiceAnswer.findUniqueOrThrow({
          where: { id: assignment.id },
          select: { selectedAnswer: true, isCorrect: true, answeredAt: true },
        });

    return {
      ok: true as const,
      questionId: validated.data.questionId,
      selectedAnswer: persisted.selectedAnswer,
      isCorrect: persisted.isCorrect === true,
      answeredAt: persisted.answeredAt?.toISOString() ?? new Date().toISOString(),
      correctAnswer: assignment.question.questionAnswer,
      explanation: assignment.question.explanation,
      answeredCount,
      correctCount,
      isComplete,
    };
  });

  if (result.ok) {
    updateTag(CACHE_TAGS.analytics(authSession.userId));
    updateTag(CACHE_TAGS.dashboardSummary(authSession.userId));
    updateTag(CACHE_TAGS.profileOverview(authSession.userId));
  }

  return result;
}

export async function restartPracticeSessionAction(input: PracticeSessionIdInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = PracticeSessionIdSchema.safeParse(input);
  if (!validated.success) notFound();

  const newSessionId = await prisma.$transaction(async (tx) => {
    const current = await tx.practiceSession.findUnique({
      where: { id: validated.data.sessionId },
      select: {
        userId: true,
        jlptLevel: true,
        section: true,
        mondaiType: true,
        questionCount: true,
        status: true,
        answers: {
          orderBy: { order: "asc" },
          select: { questionId: true, order: true },
        },
      },
    });

    if (!current || current.userId !== authSession.userId) notFound();

    if (current.status === "IN_PROGRESS") {
      await tx.practiceSession.update({
        where: { id: validated.data.sessionId },
        data: { status: "ABANDONED", finishedAt: new Date() },
      });
    }

    const fresh = await tx.practiceSession.create({
      data: {
        userId: authSession.userId,
        jlptLevel: current.jlptLevel,
        section: current.section,
        mondaiType: current.mondaiType,
        questionCount: current.questionCount,
        answers: {
          createMany: {
            data: current.answers.map((answer) => ({
              questionId: answer.questionId,
              order: answer.order,
            })),
          },
        },
      },
      select: { id: true },
    });

    return fresh.id;
  });

  redirect(`/exercises/${newSessionId}`);
}
