"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { BCRYPT_COST_FACTOR } from "@/constants";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import {
  EmailSchema,
  LoginSchema,
  RegisterSchema,
  type LoginInput,
  type RegisterInput,
} from "./schemas";
import { getSafeRedirectPath } from "./lib/safe-redirect";
import {
  clearAuthRateLimits,
  consumeAuthRateLimits,
  getRequestIpAddress,
  type AuthRateLimitBucket,
} from "./lib/rate-limit";

export type AuthActionResult =
  | { message: string; retryAfterSeconds?: number }
  | undefined;

const INVALID_CREDENTIALS_MESSAGE = "Email, username, atau password salah.";
const REGISTER_FAILED_MESSAGE =
  "Pendaftaran tidak dapat diproses. Periksa data atau masuk jika sudah memiliki akun.";
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

function getRateLimitMessage(retryAfterSeconds: number) {
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Terlalu banyak percobaan. Coba lagi dalam ${retryAfterMinutes} menit.`;
}

export async function loginAction(input: LoginInput): Promise<AuthActionResult> {
  const validatedFields = LoginSchema.safeParse(input);

  if (!validatedFields.success) {
    return { message: validatedFields.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { identifier, password, next } = validatedFields.data;
  const ipAddress = await getRequestIpAddress();
  const rateLimitBuckets = createLoginBuckets(identifier, ipAddress);
  const rateLimit = await consumeAuthRateLimits(rateLimitBuckets);

  if (!rateLimit.allowed) {
    return {
      message: getRateLimitMessage(rateLimit.retryAfterSeconds),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const normalizedEmail = identifier.toLowerCase();
  const isEmail = EmailSchema.safeParse(normalizedEmail).success;
  const user = isEmail
    ? await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, password: true },
      })
    : await prisma.user.findUnique({
        where: { username: identifier },
        select: { id: true, password: true },
      });

  const isPasswordValid = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !isPasswordValid) {
    return { message: INVALID_CREDENTIALS_MESSAGE };
  }

  await clearAuthRateLimits(rateLimitBuckets);
  await createSession(user.id);
  redirect(getSafeRedirectPath(next));
}

export async function registerAction(input: RegisterInput): Promise<AuthActionResult> {
  const validatedFields = RegisterSchema.safeParse(input);

  if (!validatedFields.success) {
    return { message: validatedFields.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { displayName, email, password, next } = validatedFields.data;
  const normalizedEmail = email.toLowerCase();
  const normalizedDisplayName = displayName.replace(/\s+/g, " ");
  const ipAddress = await getRequestIpAddress();
  const rateLimitBuckets = createRegisterBuckets(normalizedEmail, ipAddress);
  const rateLimit = await consumeAuthRateLimits(rateLimitBuckets);

  if (!rateLimit.allowed) {
    return {
      message: getRateLimitMessage(rateLimit.retryAfterSeconds),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  let userId: number;

  try {
    const user = await prisma.user.create({
      data: {
        username: null,
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        password: passwordHash,
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: REGISTER_FAILED_MESSAGE };
    }

    throw error;
  }

  await clearAuthRateLimits(rateLimitBuckets);
  await createSession(userId);
  redirect(getSafeRedirectPath(next));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
