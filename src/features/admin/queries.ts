import "server-only";

import type { JlptLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { JLPT_LEVEL_ORDER } from "@/constants/jlpt";

// Overview admin sengaja TIDAK di-cache. Halaman ini justru dibuka untuk
// memastikan kondisi database saat ini, termasuk tepat setelah import atau
// takedown; angka yang tertinggal satu revalidasi lebih berbahaya daripada
// biaya beberapa count query yang seluruhnya ditopang index.

export type LevelCoverage = {
  level: JlptLevel;
  packageCount: number;
  questionCount: number;
};

export type AdminOverview = {
  content: {
    levels: LevelCoverage[];
    totalPackages: number;
    totalQuestions: number;
  };
  explanation: {
    total: number;
    missing: number;
    unreviewedAi: number;
    answerKeyDoubt: number;
  };
  discussion: {
    publicRoots: number;
    replies: number;
    lastSevenDays: number;
  };
  people: {
    totalUsers: number;
    admins: number;
    unverified: number;
    pendingDeletion: number;
  };
  activity: {
    completedAttempts: number;
    attemptsLastSevenDays: number;
  };
  reports: {
    open: number;
    lastSevenDays: number;
    awaitingReply: number;
  };
  editorial: {
    articlesPublished: number;
    articlesDraft: number;
    articlesArchived: number;
    flashcardWords: number;
    flashcardRetiredWords: number;
    flashcardDecks: number;
  };
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    packagesByLevel,
    questionsByPackageLevel,
    totalQuestions,
    explanationTotal,
    unreviewedAi,
    answerKeyDoubt,
    publicRoots,
    replies,
    discussionRecent,
    totalUsers,
    admins,
    unverified,
    pendingDeletion,
    completedAttempts,
    attemptsRecent,
    articlesByStatus,
    flashcardWordsByLevel,
    flashcardRetiredWords,
    flashcardDecks,
    reportsOpen,
    reportsRecent,
    reportsAwaitingReply,
  ] = await Promise.all([
    prisma.testPackage.groupBy({ by: ["jlptLevel"], _count: { _all: true } }),
    // Soal tidak menyimpan level sendiri; jalurnya
    // Question -> TestPackageItem -> TestPackage.
    prisma.question.groupBy({
      by: ["testPackageItemId"],
      _count: { _all: true },
    }),
    prisma.question.count(),
    prisma.questionExplanation.count(),
    prisma.questionExplanation.count({ where: { source: "AI", reviewedAt: null } }),
    prisma.questionExplanation.count({ where: { answerKeyDoubt: true } }),
    prisma.questionComment.count({
      where: { parentId: null, sharedAt: { not: null }, visibility: "PUBLIC", deletedAt: null },
    }),
    prisma.questionComment.count({ where: { parentId: { not: null }, deletedAt: null } }),
    prisma.questionComment.count({
      where: { sharedAt: { gte: sevenDaysAgo }, deletedAt: null },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { emailVerifiedAt: null } }),
    prisma.user.count({ where: { deletionScheduledFor: { gt: now } } }),
    prisma.attempt.count({ where: { status: "COMPLETED" } }),
    prisma.attempt.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
    prisma.article.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.flashcardVocab.groupBy({
      by: ["level"],
      where: { retiredAt: null },
      _count: { _all: true },
    }),
    prisma.flashcardVocab.count({ where: { retiredAt: { not: null } } }),
    prisma.flashcardDeck.count({ where: { isPublished: true } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.report.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    // Pelapor yang meninggalkan alamat dan belum pernah dibalas. Bukan kewajiban
    // — admin berhak tidak menjawab — tetapi angkanya perlu terlihat.
    prisma.report.count({
      where: { replyEmail: { not: null }, repliedAt: null, status: { in: ["OPEN", "IN_REVIEW"] } },
    }),
  ]);

  // Satu query tambahan memetakan item -> level, jauh lebih murah daripada
  // groupBy bersarang atau count per level secara berurutan.
  const items = await prisma.testPackageItem.findMany({
    select: { id: true, testPackage: { select: { jlptLevel: true } } },
  });
  const levelByItemId = new Map(items.map((item) => [item.id, item.testPackage.jlptLevel]));

  const questionCountByLevel = new Map<JlptLevel, number>();
  for (const row of questionsByPackageLevel) {
    const level = levelByItemId.get(row.testPackageItemId);
    if (!level) continue;
    questionCountByLevel.set(level, (questionCountByLevel.get(level) ?? 0) + row._count._all);
  }

  const packageCountByLevel = new Map(
    packagesByLevel.map((row) => [row.jlptLevel, row._count._all]),
  );

  const articleCount = (status: "PUBLISHED" | "DRAFT" | "ARCHIVED") =>
    articlesByStatus.find((row) => row.status === status)?._count._all ?? 0;

  return {
    content: {
      levels: JLPT_LEVEL_ORDER.map((level) => ({
        level,
        packageCount: packageCountByLevel.get(level) ?? 0,
        questionCount: questionCountByLevel.get(level) ?? 0,
      })),
      totalPackages: packagesByLevel.reduce((sum, row) => sum + row._count._all, 0),
      totalQuestions,
    },
    explanation: {
      total: explanationTotal,
      missing: totalQuestions - explanationTotal,
      unreviewedAi,
      answerKeyDoubt,
    },
    discussion: {
      publicRoots,
      replies,
      lastSevenDays: discussionRecent,
    },
    people: {
      totalUsers,
      admins,
      unverified,
      pendingDeletion,
    },
    activity: {
      completedAttempts,
      attemptsLastSevenDays: attemptsRecent,
    },
    reports: {
      open: reportsOpen,
      lastSevenDays: reportsRecent,
      awaitingReply: reportsAwaitingReply,
    },
    editorial: {
      articlesPublished: articleCount("PUBLISHED"),
      articlesDraft: articleCount("DRAFT"),
      articlesArchived: articleCount("ARCHIVED"),
      flashcardWords: flashcardWordsByLevel.reduce((sum, row) => sum + row._count._all, 0),
      flashcardRetiredWords,
      flashcardDecks,
    },
  };
}
