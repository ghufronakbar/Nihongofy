import "server-only";

import type { Prisma } from "@prisma/client";

export function completedMockAttemptWhere(userId: number): Prisma.AttemptWhereInput {
  return { userId, status: "COMPLETED", sectionScope: null };
}

export function completedSectionAttemptWhere(userId: number): Prisma.AttemptWhereInput {
  return { userId, status: "COMPLETED", sectionScope: { not: null } };
}

export function completedQuickPracticeWhere(userId: number): Prisma.PracticeSessionWhereInput {
  return { userId, status: "COMPLETED" };
}
