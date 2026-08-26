"use server";

import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { CreateAttemptSchema, type CreateAttemptInput } from "./schemas";

const getCachedTestPackageList = unstable_cache(
  async () => {
    return prisma.testPackage.findMany({
      select: { id: true, name: true, jlptLevel: true },
      orderBy: { name: "asc" },
    });
  },
  CACHE_KEYS.testPackageList,
  { tags: [CACHE_TAGS.testPackageList] },
);

export async function getTestPackages() {
  const session = await getSession();
  if (!session) redirect("/login");

  return getCachedTestPackageList();
}

const getCachedTestPackage = (testPackageId: number) =>
  unstable_cache(
    async (id: number) => {
      return prisma.testPackage.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          jlptLevel: true,
          testPackageItems: {
            select: {
              id: true,
              mondaiType: true,
              section: true,
              session: true,
              order: true,
            },
            orderBy: [{ session: "asc" }, { order: "asc" }],
          },
        },
      });
    },
    CACHE_KEYS.testPackageDetail(testPackageId),
    { tags: [CACHE_TAGS.testPackageDetail(testPackageId)] },
  )(testPackageId);

export async function getTestPackageDetail(testPackageId: number) {
  const session = await getSession();
  if (!session) redirect("/login");

  const testPackage = await getCachedTestPackage(testPackageId);
  if (!testPackage) notFound();

  // Per-user attempt history — not cached, changes every time an attempt starts/finishes.
  const attempts = await prisma.attempt.findMany({
    where: { testPackageId, userId: session.userId },
    select: {
      id: true,
      status: true,
      sectionScope: true,
      startedAt: true,
      finishedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });

  return { testPackage, attempts };
}

const getCachedTestPackageQuestions = (testPackageId: number) =>
  unstable_cache(
    async (id: number) => {
      return prisma.testPackage.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          jlptLevel: true,
          testPackageItems: {
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
                  explanation: true,
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
                },
              },
            },
          },
        },
      });
    },
    CACHE_KEYS.testPackageQuestions(testPackageId),
    { tags: [CACHE_TAGS.testPackageQuestions(testPackageId)] },
  )(testPackageId);

// "Mode baca" (/test-package/[id]/questions) is not an attempt, so unlike exam
// mode there's no restriction on sending questionAnswer/explanation here.
export async function getTestPackageQuestions(testPackageId: number) {
  const session = await getSession();
  if (!session) redirect("/login");

  const testPackage = await getCachedTestPackageQuestions(testPackageId);
  if (!testPackage) notFound();

  // The question bank is shared and globally cacheable; private comments are not.
  const comments = await prisma.questionComment.findMany({
    where: {
      userId: session.userId,
      question: { testPackageItem: { testPackageId } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      questionId: true,
      commentText: true,
      commentImages: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { displayName: true } },
    },
  });

  const commentsByQuestion = new Map<number, typeof comments>();
  for (const comment of comments) {
    const list = commentsByQuestion.get(comment.questionId) ?? [];
    list.push(comment);
    commentsByQuestion.set(comment.questionId, list);
  }

  return {
    ...testPackage,
    testPackageItems: testPackage.testPackageItems.map((item) => ({
      ...item,
      questions: item.questions.map((question) => ({
        ...question,
        questionComments: commentsByQuestion.get(question.id) ?? [],
      })),
    })),
  };
}

export async function createAttemptAction(input: CreateAttemptInput) {
  const session = await getSession();
  if (!session) redirect("/login");

  const validated = CreateAttemptSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { testPackageId, sectionScope } = validated.data;

  const testPackage = await prisma.testPackage.findUnique({
    where: { id: testPackageId },
    select: { id: true },
  });

  if (!testPackage) {
    notFound();
  }

  const attempt = await prisma.attempt.create({
    data: {
      userId: session.userId,
      testPackageId,
      sectionScope,
    },
    select: { id: true },
  });

  redirect(`/exam/${attempt.id}/1`);
}
