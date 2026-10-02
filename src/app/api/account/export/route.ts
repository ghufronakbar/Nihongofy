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
      flashcardCollection: {
        select: { rolloverHour: true, display: true, createdAt: true, updatedAt: true },
      },
      flashcardSubscriptions: {
        orderBy: { createdAt: "asc" },
        select: {
          config: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
          deck: { select: { slug: true, name: true } },
        },
      },
      flashcardCards: {
        orderBy: [{ deckId: "asc" }, { vocabId: "asc" }],
        select: {
          subscription: { select: { deck: { select: { slug: true } } } },
          type: true,
          queue: true,
          due: true,
          intervalDays: true,
          reps: true,
          lapses: true,
          learningStep: true,
          stability: true,
          difficulty: true,
          desiredRetention: true,
          easeFactor: true,
          lastReviewedAt: true,
          isSuspended: true,
          buriedUntil: true,
          isLeech: true,
          createdAt: true,
          updatedAt: true,
          vocab: { select: { key: true, wordPlain: true, reading: true } },
        },
      },
      flashcardRevlogs: {
        orderBy: { reviewedAt: "asc" },
        select: {
          reviewedAt: true,
          rating: true,
          kind: true,
          intervalDays: true,
          lastIntervalDays: true,
          stability: true,
          difficulty: true,
          easeFactor: true,
          takenMs: true,
          card: {
            select: {
              subscription: { select: { deck: { select: { slug: true } } } },
              vocab: { select: { key: true } },
            },
          },
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
          vocabId: true,
          bunpouPointId: true,
          commentText: true,
          commentImages: true,
          createdAt: true,
          updatedAt: true,
          // Tepat satu dari `question`/`vocab`/`bunpouPoint` terisi.
          vocab: { select: { key: true, wordPlain: true, reading: true } },
          bunpouPoint: { select: { key: true, level: true, titlePlain: true } },
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
      // Laporan yang dikirim akun ini, untuk semua jenis target. Isinya hanya yang
      // ditulis pelapor dan yang memang dikirim kepadanya (balasan email). Status,
      // catatan internal, dan identitas admin yang menangani tidak ikut: catatan
      // itu tidak pernah dikirim ke pelapor (docs/module/report.md).
      reports: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          targetType: true,
          category: true,
          targetLabel: true,
          questionId: true,
          articleId: true,
          commentId: true,
          vocabId: true,
          bunpouPointId: true,
          bunpouComparisonId: true,
          message: true,
          pagePath: true,
          userAgent: true,
          replyEmail: true,
          repliedAt: true,
          replyMessage: true,
          createdAt: true,
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
