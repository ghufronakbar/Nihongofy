import "server-only";

import { AuthTokenPurpose } from "@prisma/client";
import {
  EMAIL_VERIFICATION_DURATION_SECONDS,
  PASSWORD_RESET_DURATION_SECONDS,
} from "@/constants";
import { issueAuthToken } from "./auth-token";
import { acquireEmailCooldown, releaseEmailCooldown } from "./email-cooldown";
import { sendEmailVerificationMail, sendPasswordResetMail } from "./mailer";

export async function sendVerificationEmail({
  userId,
  email,
  displayName,
}: {
  userId: number;
  email: string;
  displayName: string;
}) {
  const cooldown = await acquireEmailCooldown("verification", String(userId));
  if (!cooldown.allowed) return cooldown;

  try {
    const { token, expiresAt } = await issueAuthToken({
      userId,
      purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
      durationSeconds: EMAIL_VERIFICATION_DURATION_SECONDS,
    });
    await sendEmailVerificationMail({
      email,
      displayName,
      token,
    });
    return { ...cooldown, expiresAt };
  } catch (error) {
    await releaseEmailCooldown("verification", String(userId), cooldown.nonce);
    throw error;
  }
}

export async function sendPasswordResetEmail({
  email,
  user,
}: {
  email: string;
  user: { id: number; displayName: string } | null;
}) {
  const cooldown = await acquireEmailCooldown("password-reset", email);
  if (!cooldown.allowed) return cooldown;

  if (!user) return cooldown;

  const { token, expiresAt } = await issueAuthToken({
    userId: user.id,
    purpose: AuthTokenPurpose.PASSWORD_RESET,
    durationSeconds: PASSWORD_RESET_DURATION_SECONDS,
  });
  await sendPasswordResetMail({ email, displayName: user.displayName, token });
  return { ...cooldown, expiresAt };
}
