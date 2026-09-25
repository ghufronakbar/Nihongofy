import { NextResponse } from "next/server";
import { ACCOUNT_DELETION_CRON_BATCH_SIZE, env } from "@/constants";
import { revokeAllUserSessions } from "@/lib/auth";
import {
  destroyManagedAvatar,
  getDueAvatarCleanupKeys,
  scheduleAvatarCleanup,
  unscheduleAvatarCleanup,
} from "@/lib/r2";
import { reportServerError } from "@/lib/server-logger";
import { prisma } from "@/lib/prisma";
import { anonymizeAccount } from "@/features/auth/lib/anonymize-account";

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

  let orphanAvatarsDeleted = 0;
  let orphanAvatarFailures = 0;
  const dueAvatarKeys = await getDueAvatarCleanupKeys();
  for (const key of dueAvatarKeys) {
    const owner = await prisma.user.findUnique({
      where: { avatarPublicId: key },
      select: { id: true },
    });
    if (owner) {
      await unscheduleAvatarCleanup(key);
      continue;
    }

    try {
      const result = await destroyManagedAvatar(key);
      await unscheduleAvatarCleanup(key);
      if (result === "ok") orphanAvatarsDeleted += 1;
    } catch (error) {
      orphanAvatarFailures += 1;
      reportServerError("cron.avatar_orphan_cleanup_failed", error);
    }
  }

  const accountsDueForDeletion = await prisma.user.findMany({
    where: { deletionScheduledFor: { lte: now }, anonymizedAt: null },
    orderBy: { deletionScheduledFor: "asc" },
    take: ACCOUNT_DELETION_CRON_BATCH_SIZE,
    select: { id: true, avatarPublicId: true },
  });
  let accountsDeleted = 0;
  let accountDeletionFailures = 0;

  for (const user of accountsDueForDeletion) {
    try {
      if (user.avatarPublicId) await scheduleAvatarCleanup(user.avatarPublicId);
      await revokeAllUserSessions(user.id);

      // Anonimisasi, bukan delete: baris User harus bertahan supaya thread
      // diskusi yang dibalas orang lain tidak ikut musnah. Lihat `anonymizeAccount`.
      await anonymizeAccount(user.id);

      accountsDeleted += 1;
      if (user.avatarPublicId) {
        try {
          await destroyManagedAvatar(user.avatarPublicId);
          await unscheduleAvatarCleanup(user.avatarPublicId);
        } catch (error) {
          reportServerError("cron.deleted_account_avatar_cleanup_failed", error);
        }
      }
    } catch (error) {
      accountDeletionFailures += 1;
      reportServerError("cron.account_deletion_failed", error);
    }
  }

  return NextResponse.json({
    expiredTokensDeleted: expiredTokens.count,
    staleRateLimitsDeleted: staleRateLimits.count,
    orphanAvatarsDeleted,
    orphanAvatarFailures,
    accountsDeleted,
    accountDeletionFailures,
  });
}
