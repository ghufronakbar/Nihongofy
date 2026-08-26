import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/constants";
import { prisma } from "@/lib/prisma";

export type AuthRateLimitBucket = {
  scope: string;
  subject: string;
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds: number;
};

type RateLimitRow = {
  blockedUntil: Date | null;
};

export type AuthRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function hashBucket({ scope, subject }: Pick<AuthRateLimitBucket, "scope" | "subject">) {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(`${scope}:${subject}`)
    .digest("hex");
}

async function consumeBucket(bucket: AuthRateLimitBucket): Promise<AuthRateLimitResult> {
  const keyHash = hashBucket(bucket);
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "AuthRateLimit" (
      "keyHash",
      "attemptCount",
      "windowStartedAt",
      "blockedUntil",
      "createdAt",
      "updatedAt"
    )
    VALUES (${keyHash}, 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attemptCount" = CASE
        WHEN "AuthRateLimit"."blockedUntil" > CURRENT_TIMESTAMP
          THEN "AuthRateLimit"."attemptCount"
        WHEN "AuthRateLimit"."windowStartedAt" <= CURRENT_TIMESTAMP - (${bucket.windowSeconds} * INTERVAL '1 second')
          THEN 1
        ELSE "AuthRateLimit"."attemptCount" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= CURRENT_TIMESTAMP - (${bucket.windowSeconds} * INTERVAL '1 second')
          THEN CURRENT_TIMESTAMP
        ELSE "AuthRateLimit"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN "AuthRateLimit"."blockedUntil" > CURRENT_TIMESTAMP
          THEN "AuthRateLimit"."blockedUntil"
        WHEN "AuthRateLimit"."windowStartedAt" <= CURRENT_TIMESTAMP - (${bucket.windowSeconds} * INTERVAL '1 second')
          THEN NULL
        WHEN "AuthRateLimit"."attemptCount" + 1 > ${bucket.maxAttempts}
          THEN CURRENT_TIMESTAMP + (${bucket.blockSeconds} * INTERVAL '1 second')
        ELSE NULL
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "blockedUntil"
  `;

  const blockedUntil = rows[0]?.blockedUntil;
  const retryAfterSeconds = blockedUntil
    ? Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000))
    : 0;

  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

export async function consumeAuthRateLimits(
  buckets: AuthRateLimitBucket[],
): Promise<AuthRateLimitResult> {
  const results = await Promise.all(buckets.map(consumeBucket));
  const retryAfterSeconds = Math.max(0, ...results.map((result) => result.retryAfterSeconds));

  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

export async function clearAuthRateLimits(buckets: AuthRateLimitBucket[]) {
  if (buckets.length === 0) return;

  await prisma.authRateLimit.deleteMany({
    where: { keyHash: { in: buckets.map(hashBucket) } },
  });
}

export async function getRequestIpAddress() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate =
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    forwardedFor;

  if (!candidate) return null;
  return candidate.slice(0, 128);
}
