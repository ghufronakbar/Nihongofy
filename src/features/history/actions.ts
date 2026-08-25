"use server";

import { redirect } from "next/navigation";
import type { JlptSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Mirrors the "next session" logic in features/exam/actions.ts (submitExamSessionAction):
// the session to resume is the earliest one with no AttemptAnswer rows yet at all
// (a session is only ever submitted as a whole, in one transaction).
async function resolveResumeSession(
  attemptId: number,
  testPackageId: number,
  sectionScope: JlptSection | null,
): Promise<number> {
  if (sectionScope) return 1;

  const [sessionRows, answeredRows] = await Promise.all([
    prisma.testPackageItem.findMany({
      where: { testPackageId },
      select: { session: true },
      distinct: ["session"],
    }),
    prisma.attemptAnswer.findMany({
      where: { attemptId },
      select: { question: { select: { testPackageItem: { select: { session: true } } } } },
    }),
  ]);

  const sessionNumbers = sessionRows.map((row) => row.session).sort((a, b) => a - b);
  const answeredSessions = new Set(answeredRows.map((row) => row.question.testPackageItem.session));

  return sessionNumbers.find((session) => !answeredSessions.has(session)) ?? sessionNumbers.at(-1) ?? 1;
}

// Per-user attempt list across all packages — not cached, same reasoning as
// the per-package attempt history in features/test-package: changes every
// time an attempt starts/finishes, with a low per-user read volume.
export async function getAttemptHistory() {
  const session = await getSession();
  if (!session) redirect("/login");

  const attempts = await prisma.attempt.findMany({
    where: { userId: session.userId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      sectionScope: true,
      startedAt: true,
      finishedAt: true,
      testPackageId: true,
      testPackage: { select: { id: true, name: true, jlptLevel: true } },
    },
  });

  return Promise.all(
    attempts.map(async (attempt) => ({
      ...attempt,
      resumeSession:
        attempt.status === "IN_PROGRESS"
          ? await resolveResumeSession(attempt.id, attempt.testPackageId, attempt.sectionScope)
          : null,
    })),
  );
}
