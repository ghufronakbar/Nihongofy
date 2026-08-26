"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { CACHE_TAGS } from "@/constants/cache-key";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isKnownKanaKey } from "./data/kana";
import { KanaProgressSchema, type KanaProgressInput } from "./schemas";

export async function getKanaProgress() {
  const session = await getSession();
  if (!session) redirect("/login");

  return prisma.kanaProgress.findMany({
    where: { userId: session.userId },
    select: {
      kanaKey: true,
      viewCount: true,
      correctCount: true,
      againCount: true,
    },
  });
}

export async function recordKanaProgressAction(input: KanaProgressInput) {
  const session = await getSession();
  if (!session) return { ok: false as const, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = KanaProgressSchema.safeParse(input);
  if (!validated.success || !isKnownKanaKey(validated.data.kanaKey)) {
    return { ok: false as const, message: "Kartu kana tidak valid." };
  }

  const { kanaKey, grade } = validated.data;
  const now = new Date();
  const isGraded = grade !== "VIEWED";

  const viewIncrement = grade === "VIEWED" ? 1 : 0;
  const correctIncrement = grade === "CORRECT" ? 1 : 0;
  const againIncrement = grade === "AGAIN" ? 1 : 0;
  const lastViewedAt = grade === "VIEWED" ? now : null;
  const lastGradedAt = isGraded ? now : null;

  // A flip and a quick grade may arrive concurrently. PostgreSQL's native
  // upsert keeps both counters instead of racing on the first insert.
  await prisma.$executeRaw`
    INSERT INTO "KanaProgress" (
      "userId", "kanaKey", "viewCount", "correctCount", "againCount",
      "lastViewedAt", "lastGradedAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${session.userId}, ${kanaKey}, ${viewIncrement}, ${correctIncrement}, ${againIncrement},
      ${lastViewedAt}, ${lastGradedAt}, NOW(), NOW()
    )
    ON CONFLICT ("userId", "kanaKey") DO UPDATE SET
      "viewCount" = "KanaProgress"."viewCount" + EXCLUDED."viewCount",
      "correctCount" = "KanaProgress"."correctCount" + EXCLUDED."correctCount",
      "againCount" = "KanaProgress"."againCount" + EXCLUDED."againCount",
      "lastViewedAt" = COALESCE(EXCLUDED."lastViewedAt", "KanaProgress"."lastViewedAt"),
      "lastGradedAt" = COALESCE(EXCLUDED."lastGradedAt", "KanaProgress"."lastGradedAt"),
      "updatedAt" = NOW()
  `;

  updateTag(CACHE_TAGS.profileOverview(session.userId));

  return { ok: true as const };
}
