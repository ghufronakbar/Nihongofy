"use server";

import bcrypt from "bcryptjs";
import { AuthTokenPurpose, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { BCRYPT_COST_FACTOR, EMAIL_SEND_COOLDOWN_SECONDS } from "@/constants";
import {
  createSession,
  destroySession,
  getSession,
  revokeAllUserSessions,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ConfirmEmailSchema,
  EmailSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResetPasswordSchema,
  TurnstileOnlySchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "./schemas";
import {
  consumeEmailToken,
  consumePasswordResetToken,
  inspectAuthToken,
} from "./lib/auth-token";
import {
  clearPendingVerification,
  getPendingVerification,
  setPendingVerification,
} from "./lib/pending-verification";
import {
  clearAuthRateLimits,
  consumeAuthRateLimits,
  getRequestIpAddress,
  type AuthRateLimitBucket,
} from "./lib/rate-limit";
import { getSafeRedirectPath } from "./lib/safe-redirect";
import { sendPasswordResetEmail, sendVerificationEmail } from "./lib/send-auth-email";
import { TURNSTILE_ACTIONS } from "./lib/turnstile-config";
import { verifyTurnstileToken } from "./lib/turnstile";

export type AuthActionResult =
  | { ok: boolean; message: string; retryAfterSeconds?: number }
  | undefined;

const INVALID_CREDENTIALS_MESSAGE =
  "Tidak dapat masuk dengan password. Periksa kredensial atau gunakan Google jika akun Anda terhubung.";
const REGISTER_FAILED_MESSAGE =
  "Pendaftaran tidak dapat diproses. Periksa data atau masuk jika sudah memiliki akun.";
const FORGOT_PASSWORD_MESSAGE =
  "Jika akun dengan email tersebut tersedia, tautan reset password telah dikirim.";
const TURNSTILE_FAILED_MESSAGE =
  "Verifikasi keamanan gagal atau sudah kedaluwarsa. Silakan coba lagi.";
const DUMMY_PASSWORD_HASH =
  "$2b$12$xSzVKZE3yqwniZtPOvfAR.Zb8XjFh09I75OniRtjT5EjFWYKUS1bG";

function createLoginBuckets(identifier: string, ipAddress: string | null) {
  const buckets: AuthRateLimitBucket[] = [
    {
      scope: "login:identifier",
      subject: identifier.toLowerCase(),
      maxAttempts: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    },
  ];

  if (ipAddress) {
    buckets.push({
      scope: "login:ip",
      subject: ipAddress,
      maxAttempts: 30,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    });
  }

  return buckets;
}

function createRegisterBuckets(email: string, ipAddress: string | null) {
  const buckets: AuthRateLimitBucket[] = [
    {
      scope: "register:email",
      subject: email,
      maxAttempts: 4,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    },
  ];

  if (ipAddress) {
    buckets.push({
      scope: "register:ip",
      subject: ipAddress,
      maxAttempts: 12,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    });
  }

  return buckets;
}

function createVerificationEmailBuckets(userId: number, ipAddress: string | null) {
  const buckets: AuthRateLimitBucket[] = [
    {
      scope: "verification:user",
      subject: String(userId),
      maxAttempts: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    },
  ];

  if (ipAddress) {
    buckets.push({
      scope: "verification:ip",
      subject: ipAddress,
      maxAttempts: 20,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    });
  }

  return buckets;
}

function createForgotPasswordBuckets(email: string, ipAddress: string | null) {
  const buckets: AuthRateLimitBucket[] = [
    {
      scope: "forgot-password:email",
      subject: email,
      maxAttempts: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    },
  ];

  if (ipAddress) {
    buckets.push({
      scope: "forgot-password:ip",
      subject: ipAddress,
      maxAttempts: 20,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    });
  }

  return buckets;
}

function getRateLimitMessage(retryAfterSeconds: number) {
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterMinutes} menit.`;
}

async function deliverVerificationEmail({
  user,
  ipAddress,
}: {
  user: { id: number; email: string; displayName: string };
  ipAddress: string | null;
}) {
  const rateLimit = await consumeAuthRateLimits(
    createVerificationEmailBuckets(user.id, ipAddress),
  );
  if (!rateLimit.allowed) {
    return { status: "limited" as const, retryAfterSeconds: rateLimit.retryAfterSeconds };
  }

  try {
    const result = await sendVerificationEmail({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    });
    return {
      status: result.allowed ? ("sent" as const) : ("cooldown" as const),
      retryAfterSeconds: result.retryAfterSeconds,
    };
  } catch {
    return { status: "failed" as const, retryAfterSeconds: 0 };
  }
}

function verificationRedirect(status: "sent" | "cooldown" | "limited" | "failed") {
  redirect(`/verify-email?delivery=${status}`);
}

export async function loginAction(input: LoginInput): Promise<AuthActionResult> {
  const validatedFields = LoginSchema.safeParse(input);

  if (!validatedFields.success) {
    return {
      ok: false,
      message: validatedFields.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const { identifier, password, next, turnstileToken } = validatedFields.data;
  const ipAddress = await getRequestIpAddress();
  const turnstileValid = await verifyTurnstileToken({
    token: turnstileToken,
    expectedAction: TURNSTILE_ACTIONS.login,
    remoteIp: ipAddress,
  });
  if (!turnstileValid) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const rateLimitBuckets = createLoginBuckets(identifier, ipAddress);
  const rateLimit = await consumeAuthRateLimits(rateLimitBuckets);

  if (!rateLimit.allowed) {
    return {
      ok: false,
      message: getRateLimitMessage(rateLimit.retryAfterSeconds),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const normalizedEmail = identifier.toLowerCase();
  const isEmail = EmailSchema.safeParse(normalizedEmail).success;
  const select = {
    id: true,
    email: true,
    displayName: true,
    password: true,
    emailVerifiedAt: true,
    deletionScheduledFor: true,
  } satisfies Prisma.UserSelect;
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: normalizedEmail }, select })
    : await prisma.user.findUnique({ where: { username: identifier }, select });

  const isPasswordValid = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !isPasswordValid) {
    return { ok: false, message: INVALID_CREDENTIALS_MESSAGE };
  }

  await clearAuthRateLimits(
    rateLimitBuckets.filter((bucket) => bucket.scope === "login:identifier"),
  );
  const nextPath = getSafeRedirectPath(next);

  if (user.email && !user.emailVerifiedAt) {
    await setPendingVerification({ userId: user.id, email: user.email, next: nextPath });
    const delivery = await deliverVerificationEmail({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      ipAddress,
    });
    verificationRedirect(delivery.status);
  }

  if (user.deletionScheduledFor) {
    if (user.deletionScheduledFor.getTime() <= Date.now()) {
      return {
        ok: false,
        message: "Akun ini sudah melewati masa pemulihan dan sedang menunggu penghapusan permanen.",
      };
    }

    await createSession(user.id);
    redirect("/profile/privacy?deletion=pending");
  }

  await createSession(user.id);
  redirect(nextPath);
}

export async function registerAction(input: RegisterInput): Promise<AuthActionResult> {
  const validatedFields = RegisterSchema.safeParse(input);

  if (!validatedFields.success) {
    return {
      ok: false,
      message: validatedFields.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const { displayName, email, password, next, turnstileToken } = validatedFields.data;
  const normalizedEmail = email.toLowerCase();
  const normalizedDisplayName = displayName.replace(/\s+/g, " ");
  const ipAddress = await getRequestIpAddress();
  const turnstileValid = await verifyTurnstileToken({
    token: turnstileToken,
    expectedAction: TURNSTILE_ACTIONS.register,
    remoteIp: ipAddress,
  });
  if (!turnstileValid) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const rateLimitBuckets = createRegisterBuckets(normalizedEmail, ipAddress);
  const rateLimit = await consumeAuthRateLimits(rateLimitBuckets);

  if (!rateLimit.allowed) {
    return {
      ok: false,
      message: getRateLimitMessage(rateLimit.retryAfterSeconds),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  let user: { id: number; email: string; displayName: string };

  try {
    const createdUser = await prisma.user.create({
      data: {
        username: null,
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        emailVerifiedAt: null,
        password: passwordHash,
      },
      select: { id: true, email: true, displayName: true },
    });
    user = {
      id: createdUser.id,
      email: normalizedEmail,
      displayName: createdUser.displayName,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: REGISTER_FAILED_MESSAGE };
    }

    throw error;
  }

  await clearAuthRateLimits(
    rateLimitBuckets.filter((bucket) => bucket.scope === "register:email"),
  );
  await setPendingVerification({
    userId: user.id,
    email: user.email,
    next: getSafeRedirectPath(next),
  });
  const delivery = await deliverVerificationEmail({ user, ipAddress });
  verificationRedirect(delivery.status);
}

export async function resendVerificationAction(input: unknown): Promise<AuthActionResult> {
  const validated = TurnstileOnlySchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const ipAddress = await getRequestIpAddress();
  const turnstileValid = await verifyTurnstileToken({
    token: validated.data.turnstileToken,
    expectedAction: TURNSTILE_ACTIONS.resendVerification,
    remoteIp: ipAddress,
  });
  if (!turnstileValid) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const pending = await getPendingVerification();
  if (!pending) {
    return { ok: false, message: "Permintaan verifikasi tidak tersedia. Silakan masuk lagi." };
  }

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: { id: true, email: true, displayName: true, emailVerifiedAt: true },
  });
  if (!user || user.email !== pending.email) {
    await clearPendingVerification();
    return { ok: false, message: "Permintaan verifikasi sudah tidak berlaku." };
  }
  if (user.emailVerifiedAt) {
    await clearPendingVerification();
    return { ok: true, message: "Email sudah terverifikasi. Silakan masuk." };
  }

  const delivery = await deliverVerificationEmail({
    user: { id: user.id, email: user.email, displayName: user.displayName },
    ipAddress,
  });
  if (delivery.status === "sent") {
    return {
      ok: true,
      message: "Email verifikasi baru telah dikirim.",
      retryAfterSeconds: delivery.retryAfterSeconds,
    };
  }
  if (delivery.status === "cooldown") {
    return {
      ok: false,
      message: "Tunggu sebelum mengirim email verifikasi lagi.",
      retryAfterSeconds: delivery.retryAfterSeconds,
    };
  }
  if (delivery.status === "limited") {
    return {
      ok: false,
      message: getRateLimitMessage(delivery.retryAfterSeconds),
      retryAfterSeconds: delivery.retryAfterSeconds,
    };
  }
  return { ok: false, message: "Email belum dapat dikirim. Silakan coba kembali." };
}

export async function confirmEmailAction(input: unknown): Promise<AuthActionResult> {
  const validated = ConfirmEmailSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Tautan verifikasi tidak valid." };

  const turnstileValid = await verifyTurnstileToken({
    token: validated.data.turnstileToken,
    expectedAction: TURNSTILE_ACTIONS.confirmEmail,
    remoteIp: await getRequestIpAddress(),
  });
  if (!turnstileValid) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const pending = await getPendingVerification();
  const inspectedToken = await inspectAuthToken(validated.data.token);
  if (!inspectedToken) {
    return { ok: false, message: "Tautan sudah digunakan, kedaluwarsa, atau tidak valid." };
  }
  const activeSession = await getSession();
  if (activeSession && activeSession.userId !== inspectedToken.userId) {
    return { ok: false, message: "Tautan ini tidak sesuai dengan akun yang sedang aktif." };
  }
  const result = await consumeEmailToken(validated.data.token);
  if (!result.ok) {
    return {
      ok: false,
      message: "Tautan sudah digunakan, kedaluwarsa, atau tidak valid.",
    };
  }

  await revokeAllUserSessions(result.userId);
  await createSession(result.userId);
  await clearPendingVerification();

  const nextPath =
    pending?.userId === result.userId
      ? getSafeRedirectPath(pending.next)
      : "/dashboard";
  redirect(nextPath);
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput,
): Promise<AuthActionResult> {
  const validated = ForgotPasswordSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Email tidak valid.",
    };
  }

  const { email, turnstileToken } = validated.data;
  const ipAddress = await getRequestIpAddress();
  const turnstileValid = await verifyTurnstileToken({
    token: turnstileToken,
    expectedAction: TURNSTILE_ACTIONS.forgotPassword,
    remoteIp: ipAddress,
  });
  if (!turnstileValid) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const rateLimit = await consumeAuthRateLimits(
    createForgotPasswordBuckets(email, ipAddress),
  );
  if (!rateLimit.allowed) {
    return {
      ok: true,
      message: FORGOT_PASSWORD_MESSAGE,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true },
  });

  try {
    const delivery = await sendPasswordResetEmail({ email, user });
    return {
      ok: true,
      message: FORGOT_PASSWORD_MESSAGE,
      retryAfterSeconds: delivery.retryAfterSeconds,
    };
  } catch {
    return {
      ok: true,
      message: FORGOT_PASSWORD_MESSAGE,
      retryAfterSeconds: EMAIL_SEND_COOLDOWN_SECONDS,
    };
  }
}

export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<AuthActionResult> {
  const validated = ResetPasswordSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Data password tidak valid.",
    };
  }

  const turnstileValid = await verifyTurnstileToken({
    token: validated.data.turnstileToken,
    expectedAction: TURNSTILE_ACTIONS.resetPassword,
    remoteIp: await getRequestIpAddress(),
  });
  if (!turnstileValid) {
    return { ok: false, message: TURNSTILE_FAILED_MESSAGE };
  }

  const passwordHash = await bcrypt.hash(validated.data.password, BCRYPT_COST_FACTOR);
  const inspectedToken = await inspectAuthToken(validated.data.token);
  if (!inspectedToken || inspectedToken.purpose !== AuthTokenPurpose.PASSWORD_RESET) {
    return {
      ok: false,
      message: "Tautan sudah digunakan, kedaluwarsa, atau tidak valid.",
    };
  }

  await revokeAllUserSessions(inspectedToken.userId);
  const userId = await consumePasswordResetToken(validated.data.token, passwordHash);
  if (!userId) {
    return {
      ok: false,
      message: "Tautan sudah digunakan, kedaluwarsa, atau tidak valid.",
    };
  }

  await destroySession();
  redirect("/login?passwordReset=success");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
