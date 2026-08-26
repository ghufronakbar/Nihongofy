"use server";

import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CACHE_TAGS } from "@/constants/cache-key";
import { SubmitExamSessionSchema, type SubmitExamSessionInput } from "./schemas";

// Exam-mode data-leak guard (docs/database.md): questionAnswer & explanation
// must never be selected here — only exposed post-submit via the result feature.
export async function getExamQuestions(attemptId: number, urlSession: number) {
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
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptId}`);

  // Section-scoped practice always collapses onto a single virtual session (1),
  // regardless of which real session number(s) that section's items live in.
  if (attempt.sectionScope) {
    if (urlSession !== 1) notFound();
  } else {
    const sessionRows = await prisma.testPackageItem.findMany({
      where: { testPackageId: attempt.testPackageId },
      select: { session: true },
      distinct: ["session"],
    });
    if (!sessionRows.some((row) => row.session === urlSession)) notFound();
  }

  const testPackageItems = await prisma.testPackageItem.findMany({
    where: attempt.sectionScope
      ? { testPackageId: attempt.testPackageId, section: attempt.sectionScope }
      : { testPackageId: attempt.testPackageId, session: urlSession },
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
          questionContext: {
            select: { id: true, storyText: true, storyImage: true, storyAudio: true },
          },
          questionChoices: {
            orderBy: { codeAnswer: "asc" },
            select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
          },
        },
      },
    },
  });

  return { attempt, testPackageItems };
}

export async function submitExamSessionAction(input: SubmitExamSessionInput) {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = SubmitExamSessionSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { attemptId, session: urlSession, answers } = validated.data;

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, testPackageId: true, sectionScope: true, status: true },
  });

  if (!attempt || attempt.userId !== authSession.userId) notFound();
  if (attempt.status === "COMPLETED") redirect(`/result/${attemptId}`);

  const scopedWhere = attempt.sectionScope
    ? { testPackageId: attempt.testPackageId, section: attempt.sectionScope }
    : { testPackageId: attempt.testPackageId };

  // Recompute the valid session list server-side rather than trusting the
  // client — also tells us whether this was the last session to submit.
  const sessionRows = await prisma.testPackageItem.findMany({
    where: scopedWhere,
    select: { session: true },
    distinct: ["session"],
  });
  const sessionNumbers = sessionRows.map((row) => row.session).sort((a, b) => a - b);

  const isValidSession = attempt.sectionScope
    ? urlSession === 1
    : sessionNumbers.includes(urlSession);

  if (!isValidSession) notFound();

  const currentItemWhere = attempt.sectionScope
    ? scopedWhere
    : { ...scopedWhere, session: urlSession };

  const testPackageItems = await prisma.testPackageItem.findMany({
    where: currentItemWhere,
    select: { questions: { select: { id: true, questionAnswer: true } } },
  });

  const answerKey = new Map<number, number>();
  for (const item of testPackageItems) {
    for (const question of item.questions) {
      answerKey.set(question.id, question.questionAnswer);
    }
  }

  // Only accept answers for questions that actually belong to this session/scope.
  const answerRows = answers
    .filter((answer) => answerKey.has(answer.questionId))
    .map((answer) => ({
      attemptId,
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
      isCorrect:
        answer.selectedAnswer !== null &&
        answer.selectedAnswer === answerKey.get(answer.questionId),
      flagged: answer.flagged,
    }));

  await prisma.$transaction(
    answerRows.map((row) =>
      prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId: row.attemptId, questionId: row.questionId } },
        create: row,
        update: {
          selectedAnswer: row.selectedAnswer,
          isCorrect: row.isCorrect,
          flagged: row.flagged,
        },
      }),
    ),
  );

  const isLastSession = attempt.sectionScope ? true : sessionNumbers.at(-1) === urlSession;

  if (isLastSession) {
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });
    updateTag(CACHE_TAGS.dashboardSummary(authSession.userId));
    updateTag(CACHE_TAGS.analytics(authSession.userId));
    updateTag(CACHE_TAGS.profileOverview(authSession.userId));
    redirect(`/result/${attemptId}`);
  }

  const nextSession = sessionNumbers[sessionNumbers.indexOf(urlSession) + 1];
  redirect(`/exam/${attemptId}/${nextSession}`);
}
