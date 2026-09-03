"use server";

import bcrypt from "bcryptjs";
import { OAuthProvider } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { ACCOUNT_DELETION_GRACE_PERIOD_SECONDS } from "@/constants";
import { CACHE_TAGS } from "@/constants/cache-key";
import {
  createSession,
  destroySession,
  getSession,
  revokeAllUserSessions,
  revokeUserSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  consumeAuthRateLimits,
  getRequestIpAddress,
  type AuthRateLimitBucket,
} from "@/features/auth/lib/rate-limit";
import { consumeGoogleOAuthReauthProof } from "@/features/auth/lib/google-oauth-state";
import {
  CancelAccountDeletionSchema,
  PrivacyPreferencesSchema,
  RequestAccountDeletionSchema,
  type CancelAccountDeletionInput,
  type PrivacyPreferencesInput,
  type RequestAccountDeletionInput,
} from "./schemas";

export type PrivacyActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function consumeAccountLifecycleRateLimit(
  userId: number,
  operation: "request" | "cancel",
) {
  const ipAddress = await getRequestIpAddress();
  const buckets: AuthRateLimitBucket[] = [
    {
      scope: `account-deletion-${operation}:user`,
      subject: String(userId),
      maxAttempts: 5,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    },
  ];
  if (ipAddress) {
    buckets.push({
      scope: `account-deletion-${operation}:ip`,
      subject: ipAddress,
      maxAttempts: 20,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    });
  }

  return consumeAuthRateLimits(buckets);
}

export async function getPrivacySettingsAction() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      allowAudioStorage: true,
      allowConversationStorage: true,
      deletionRequestedAt: true,
      deletionScheduledFor: true,
      timeZone: true,
      password: true,
      oauthAccounts: {
        where: { provider: OAuthProvider.GOOGLE },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) redirect("/login");

  return {
    allowAudioStorage: user.allowAudioStorage,
    allowConversationStorage: user.allowConversationStorage,
    timeZone: user.timeZone,
    hasPassword: Boolean(user.password),
    googleConnected: Boolean(user.oauthAccounts[0]),
    deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
    deletionScheduledFor: user.deletionScheduledFor?.toISOString() ?? null,
  };
}

export async function updatePrivacyPreferencesAction(
  input: PrivacyPreferencesInput,
): Promise<PrivacyActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = PrivacyPreferencesSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: "Preferensi privasi tidak valid." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: validated.data,
    select: { id: true },
  });

  revalidatePath("/profile/privacy");
  return { ok: true, message: "Preferensi privasi berhasil disimpan." };
}

export async function requestAccountDeletionAction(
  input: RequestAccountDeletionInput,
): Promise<PrivacyActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = RequestAccountDeletionSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Konfirmasi penghapusan tidak valid.",
    };
  }

  const rateLimit = await consumeAccountLifecycleRateLimit(session.userId, "request");
  if (!rateLimit.allowed) {
    return { ok: false, message: "Terlalu banyak percobaan. Coba lagi nanti." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      password: true,
      deletionScheduledFor: true,
      oauthAccounts: {
        where: { provider: OAuthProvider.GOOGLE },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const authorized = user.password
    ? Boolean(
        validated.data.currentPassword &&
          (await bcrypt.compare(validated.data.currentPassword, user.password)),
      )
    : Boolean(user.oauthAccounts[0]) &&
      (await consumeGoogleOAuthReauthProof({
        userId: session.userId,
        purpose: "request-deletion",
      }));
  if (!authorized) {
    return {
      ok: false,
      message: user.password
        ? "Password saat ini tidak cocok."
        : "Verifikasi Google berakhir. Verifikasi ulang dahulu.",
    };
  }

  if (!user.deletionScheduledFor) {
    const requestedAt = new Date();
    const scheduledFor = new Date(
      requestedAt.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_SECONDS * 1000,
    );

    // Revoke first: a Redis failure must not leave a scheduled account with live sessions.
    await revokeAllUserSessions(session.userId);
    await prisma.user.update({
      where: { id: session.userId },
      data: { deletionRequestedAt: requestedAt, deletionScheduledFor: scheduledFor },
      select: { id: true },
    });
  }

  updateTag(CACHE_TAGS.profileAccount(session.userId));
  await destroySession();
  redirect("/login?accountDeletion=requested");
}

export async function cancelAccountDeletionAction(
  input: CancelAccountDeletionInput,
): Promise<PrivacyActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = CancelAccountDeletionSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Password wajib diisi.",
    };
  }

  const rateLimit = await consumeAccountLifecycleRateLimit(session.userId, "cancel");
  if (!rateLimit.allowed) {
    return { ok: false, message: "Terlalu banyak percobaan. Coba lagi nanti." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      password: true,
      deletionScheduledFor: true,
      oauthAccounts: {
        where: { provider: OAuthProvider.GOOGLE },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const authorized = user.password
    ? Boolean(
        validated.data.currentPassword &&
          (await bcrypt.compare(validated.data.currentPassword, user.password)),
      )
    : Boolean(user.oauthAccounts[0]) &&
      (await consumeGoogleOAuthReauthProof({
        userId: session.userId,
        purpose: "cancel-deletion",
      }));
  if (!authorized) {
    return {
      ok: false,
      message: user.password
        ? "Password saat ini tidak cocok."
        : "Verifikasi Google berakhir. Verifikasi ulang dahulu.",
    };
  }

  if (!user.deletionScheduledFor) {
    return { ok: true, message: "Jadwal penghapusan akun sudah dibatalkan." };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { deletionRequestedAt: null, deletionScheduledFor: null },
    select: { id: true },
  });
  updateTag(CACHE_TAGS.profileAccount(session.userId));
  revalidatePath("/profile/privacy");
  await revokeUserSession(session.userId, session.sessionId);
  await createSession(session.userId);

  return { ok: true, message: "Penghapusan akun dibatalkan. Akun kembali aktif." };
}
