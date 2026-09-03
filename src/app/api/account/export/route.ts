import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      emailVerifiedAt: true,
      avatarUrl: true,
      avatarPublicId: true,
      avatarFormat: true,
      avatarBytes: true,
      timeZone: true,
      allowAudioStorage: true,
      allowConversationStorage: true,
      deletionRequestedAt: true,
      deletionScheduledFor: true,
      createdAt: true,
      updatedAt: true,
      oauthAccounts: {
        orderBy: { createdAt: "asc" },
        select: {
          provider: true,
          providerEmail: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      kanaProgresses: {
        orderBy: { kanaKey: "asc" },
        select: {
          id: true,
          kanaKey: true,
          viewCount: true,
          correctCount: true,
          againCount: true,
          lastViewedAt: true,
          lastGradedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      flashcardSetting: {
        select: {
          newCardsPerDay: true,
          maxReviewsPerDay: true,
          learningStepsMinutes: true,
          graduatingIntervalDays: true,
          easyIntervalDays: true,
          startingEaseFactor: true,
          relearningStepsMinutes: true,
          lapseIntervalMultiplier: true,
          minimumIntervalDays: true,
          maximumIntervalDays: true,
          intervalModifier: true,
          easyBonus: true,
          hardMultiplier: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      flashcardProgresses: {
        orderBy: { updatedAt: "asc" },
        select: {
          id: true,
          state: true,
          dueAt: true,
          intervalDays: true,
          easeFactor: true,
          repetitions: true,
          lapses: true,
          learningStep: true,
          lastReviewedAt: true,
          createdAt: true,
          updatedAt: true,
          flashcard: {
            select: { id: true, key: true, word: true, reading: true, jlptLevel: true },
          },
        },
      },
      flashcardReviewLogs: {
        orderBy: { reviewedAt: "asc" },
        select: {
          id: true,
          rating: true,
          previousInterval: true,
          scheduledInterval: true,
          previousEaseFactor: true,
          nextEaseFactor: true,
          wasNew: true,
          reviewedAt: true,
          dueAt: true,
          flashcard: { select: { id: true, key: true, word: true, reading: true } },
        },
      },
      attempts: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          sectionScope: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          updatedAt: true,
          testPackage: { select: { id: true, name: true, jlptLevel: true } },
          answers: {
            orderBy: { questionId: "asc" },
            select: {
              id: true,
              questionId: true,
              selectedAnswer: true,
              isCorrect: true,
              flagged: true,
              timeSpentSec: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
      practiceSessions: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          jlptLevel: true,
          section: true,
          mondaiType: true,
          questionCount: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          updatedAt: true,
          answers: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              questionId: true,
              order: true,
              selectedAnswer: true,
              isCorrect: true,
              answeredAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
      questionComments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          questionId: true,
          commentText: true,
          commentImages: true,
          createdAt: true,
          updatedAt: true,
          question: {
            select: {
              order: true,
              testPackageItem: {
                select: {
                  mondaiType: true,
                  section: true,
                  session: true,
                  testPackage: { select: { id: true, name: true, jlptLevel: true } },
                },
              },
            },
          },
        },
      },
      articleInteractions: {
        orderBy: { updatedAt: "asc" },
        select: {
          id: true,
          saved: true,
          favorited: true,
          lastViewedAt: true,
          createdAt: true,
          updatedAt: true,
          article: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });

  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  const exportedAt = new Date();
  const body = JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: exportedAt.toISOString(),
      account,
    },
    null,
    2,
  );

  return new Response(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="jlpt-account-export-${exportedAt.toISOString().slice(0, 10)}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
