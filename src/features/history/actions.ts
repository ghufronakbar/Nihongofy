"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
      // Sesi yang dibuka "Lanjutkan Ujian"; dijaga submitExamSessionAction.
      currentSession: true,
      startedAt: true,
      finishedAt: true,
      testPackageId: true,
      testPackage: { select: { id: true, name: true, jlptLevel: true } },
    },
  });

  return attempts.map(({ currentSession, ...attempt }) => ({
    ...attempt,
    resumeSession: attempt.status === "IN_PROGRESS" ? currentSession : null,
  }));
}
