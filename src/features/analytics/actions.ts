"use server";

import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import type { JlptLevel, JlptSection, MondaiType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { JLPT_LEVEL_ORDER } from "@/constants/jlpt";
import type { MondaiStatInput } from "@/lib/jlpt-score";
import {
  completedMockAttemptWhere,
  completedQuickPracticeWhere,
} from "@/lib/activity-metrics";

// Scope memisahkan attempt mock/section dan practice. "ALL" menggabungkan
// keduanya di panel masing-masing tanpa mencampur perhitungan skor.
export type AnalyticsScope = "ALL" | "MOCK" | "PRACTICE" | JlptSection;

export type AnalyticsFilters = {
  scope: AnalyticsScope;
  // ISO date strings (bukan Date) supaya argumen ini stabil untuk dijadikan
  // cache key otomatis oleh unstable_cache.
  fromIso?: string;
  toIso?: string;
};

function buildAttemptWhere(userId: number, filters: AnalyticsFilters): Prisma.AttemptWhereInput {
  const where: Prisma.AttemptWhereInput = { userId, status: "COMPLETED" };

  if (filters.scope === "PRACTICE") {
    where.id = -1;
  } else if (filters.scope === "MOCK") {
    Object.assign(where, completedMockAttemptWhere(userId));
  } else if (filters.scope !== "ALL") {
    where.sectionScope = filters.scope;
  }

  if (filters.fromIso || filters.toIso) {
    where.finishedAt = {
      ...(filters.fromIso ? { gte: new Date(filters.fromIso) } : {}),
      ...(filters.toIso ? { lte: new Date(filters.toIso) } : {}),
    };
  }

  return where;
}

function buildPracticeWhere(
  userId: number,
  filters: AnalyticsFilters,
): Prisma.PracticeSessionWhereInput {
  const where: Prisma.PracticeSessionWhereInput = completedQuickPracticeWhere(userId);

  if (filters.scope === "MOCK") {
    where.id = -1;
  } else if (filters.scope !== "ALL" && filters.scope !== "PRACTICE") {
    where.section = filters.scope;
  }

  if (filters.fromIso || filters.toIso) {
    where.finishedAt = {
      ...(filters.fromIso ? { gte: new Date(filters.fromIso) } : {}),
      ...(filters.toIso ? { lte: new Date(filters.toIso) } : {}),
    };
  }

  return where;
}

// Per-mondai stats can't be a Prisma `groupBy` since mondaiType lives on
// TestPackageItem, two relations away from AttemptAnswer — fetch the flat rows
// and aggregate in JS instead (the per-user result set remains small).
// Grouped per JLPT level: mixing N2 and N5 answers in one aggregate would be
// meaningless, so each level gets its own table.
const getCachedAnalytics = (userId: number) =>
  unstable_cache(
    // `filters` is a real argument (not a closure) so unstable_cache derives
    // a distinct cache key per filter combination automatically.
    async (id: number, filters: AnalyticsFilters) => {
      const attemptWhere = buildAttemptWhere(id, filters);
      const practiceWhere = buildPracticeWhere(id, filters);

      const [attempts, answers, practiceSessions] = await Promise.all([
        prisma.attempt.findMany({
          where: attemptWhere,
          orderBy: { finishedAt: "asc" },
          select: {
            id: true,
            finishedAt: true,
            sectionScope: true,
            testPackage: { select: { name: true, jlptLevel: true } },
            answers: { select: { isCorrect: true } },
          },
        }),
        prisma.attemptAnswer.findMany({
          where: { attempt: attemptWhere },
          select: {
            isCorrect: true,
            question: {
              select: { testPackageItem: { select: { mondaiType: true } } },
            },
            attempt: {
              select: { testPackage: { select: { jlptLevel: true } } },
            },
          },
        }),
        prisma.practiceSession.findMany({
          where: practiceWhere,
          orderBy: { finishedAt: "desc" },
          select: {
            jlptLevel: true,
            answers: {
              where: { answeredAt: { not: null } },
              select: { isCorrect: true },
            },
          },
        }),
      ]);

      const trend = attempts.map((attempt) => {
        const total = attempt.answers.length;
        const correct = attempt.answers.filter((a) => a.isCorrect).length;
        return {
          id: attempt.id,
          finishedAt: attempt.finishedAt,
          packageName: attempt.testPackage.name,
          jlptLevel: attempt.testPackage.jlptLevel,
          sectionScope: attempt.sectionScope,
          totalQuestions: total,
          totalCorrect: correct,
          scorePercentage: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      });

      const byLevel = new Map<JlptLevel, Map<MondaiType, { correct: number; total: number }>>();

      for (const answer of answers) {
        const level = answer.attempt.testPackage.jlptLevel;
        const mondaiType = answer.question.testPackageItem.mondaiType;

        const levelMap = byLevel.get(level) ?? new Map();
        const stat = levelMap.get(mondaiType) ?? { correct: 0, total: 0 };
        stat.total += 1;
        if (answer.isCorrect) stat.correct += 1;
        levelMap.set(mondaiType, stat);
        byLevel.set(level, levelMap);
      }

      const levelStats = JLPT_LEVEL_ORDER.filter((level) => byLevel.has(level)).map((level) => ({
        level,
        mondaiStats: Array.from(
          byLevel.get(level)!,
          ([mondaiType, stat]): MondaiStatInput => ({ mondaiType, ...stat }),
        ),
      }));

      const practiceTotals = practiceSessions.reduce(
        (total, practice) => {
          total.questions += practice.answers.length;
          total.correct += practice.answers.filter((answer) => answer.isCorrect === true).length;
          return total;
        },
        { questions: 0, correct: 0 },
      );

      const practiceByLevel = JLPT_LEVEL_ORDER.map((level) => {
        const sessions = practiceSessions.filter((practice) => practice.jlptLevel === level);
        const questions = sessions.reduce((total, practice) => total + practice.answers.length, 0);
        const correct = sessions.reduce(
          (total, practice) =>
            total + practice.answers.filter((answer) => answer.isCorrect === true).length,
          0,
        );
        return {
          level,
          sessions: sessions.length,
          questions,
          correct,
          accuracy: questions > 0 ? Math.round((correct / questions) * 100) : 0,
        };
      }).filter((row) => row.sessions > 0);

      return {
        trend,
        levelStats,
        practiceSummary: {
          sessions: practiceSessions.length,
          questions: practiceTotals.questions,
          correct: practiceTotals.correct,
          accuracy:
            practiceTotals.questions > 0
              ? Math.round((practiceTotals.correct / practiceTotals.questions) * 100)
              : 0,
          byLevel: practiceByLevel,
        },
      };
    },
    CACHE_KEYS.analytics(userId),
    { tags: [CACHE_TAGS.analytics(userId)] },
  );

export async function getAnalytics(filters: AnalyticsFilters = { scope: "ALL" }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return getCachedAnalytics(session.userId)(session.userId, filters);
}
