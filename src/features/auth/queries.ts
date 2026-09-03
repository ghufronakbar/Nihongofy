import "server-only";

import { AuthTokenPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inspectAuthToken } from "./lib/auth-token";
import { getEmailCooldownSeconds } from "./lib/email-cooldown";
import { getPendingVerification } from "./lib/pending-verification";

export function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export async function getPendingVerificationPageData() {
  const pending = await getPendingVerification();
  if (!pending) return null;

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!user || user.email !== pending.email) return null;

  const token = await prisma.authToken.findUnique({
    where: {
      userId_purpose: {
        userId: pending.userId,
        purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
      },
    },
    select: { expiresAt: true },
  });

  return {
    email: maskEmail(pending.email),
    verified: Boolean(user.emailVerifiedAt),
    cooldownSeconds: await getEmailCooldownSeconds(
      "verification",
      String(pending.userId),
    ),
    expiresAt: token?.expiresAt.toISOString() ?? null,
  };
}

export async function getEmailTokenPageData(token: string) {
  const authToken = await inspectAuthToken(token);
  if (!authToken || authToken.purpose !== AuthTokenPurpose.EMAIL_VERIFICATION) {
    return null;
  }

  const email = authToken.user.email;
  if (!email) return null;

  return {
    email: maskEmail(email),
    expiresAt: authToken.expiresAt.toISOString(),
  };
}

export async function getPasswordResetTokenPageData(token: string) {
  const authToken = await inspectAuthToken(token);
  if (!authToken || authToken.purpose !== AuthTokenPurpose.PASSWORD_RESET) return null;

  return {
    email: authToken.user.email ? maskEmail(authToken.user.email) : "akun Anda",
    expiresAt: authToken.expiresAt.toISOString(),
  };
}
