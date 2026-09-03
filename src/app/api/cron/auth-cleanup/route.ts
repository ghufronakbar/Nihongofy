import { NextResponse } from "next/server";
import { env } from "@/constants";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const staleRateLimitCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [expiredTokens, staleRateLimits] = await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.authRateLimit.deleteMany({ where: { updatedAt: { lt: staleRateLimitCutoff } } }),
  ]);

  return NextResponse.json({
    expiredTokensDeleted: expiredTokens.count,
    staleRateLimitsDeleted: staleRateLimits.count,
  });
}
