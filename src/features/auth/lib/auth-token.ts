import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { AuthTokenPurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const AUTH_TOKEN_BYTES = 32;

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueAuthToken({
  userId,
  purpose,
  durationSeconds,
  targetEmail,
}: {
  userId: number;
  purpose: AuthTokenPurpose;
  durationSeconds: number;
  targetEmail?: string;
}) {
  const token = randomBytes(AUTH_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashAuthToken(token);
  const expiresAt = new Date(Date.now() + durationSeconds * 1000);

  await prisma.authToken.upsert({
    where: { userId_purpose: { userId, purpose } },
    create: { userId, purpose, tokenHash, targetEmail, expiresAt },
    update: { tokenHash, targetEmail, expiresAt },
    select: { id: true },
  });

  return { token, expiresAt };
}

export async function inspectAuthToken(token: string) {
  if (token.length < 32 || token.length > 128) return null;

  const authToken = await prisma.authToken.findUnique({
    where: { tokenHash: hashAuthToken(token) },
    select: {
      userId: true,
      purpose: true,
      targetEmail: true,
      expiresAt: true,
      user: { select: { email: true } },
    },
  });

  if (!authToken || authToken.expiresAt.getTime() <= Date.now()) return null;
  return authToken;
}

export async function consumeEmailToken(token: string) {
  const tokenHash = hashAuthToken(token);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const authToken = await tx.authToken.findUnique({
          where: { tokenHash },
          select: { id: true, userId: true, purpose: true, targetEmail: true, expiresAt: true },
        });
        if (
          !authToken ||
          (authToken.purpose !== AuthTokenPurpose.EMAIL_VERIFICATION &&
            authToken.purpose !== AuthTokenPurpose.EMAIL_CHANGE) ||
          authToken.expiresAt.getTime() <= Date.now()
        ) {
          return { ok: false as const, reason: "invalid" as const };
        }

        const deleted = await tx.authToken.deleteMany({
          where: { id: authToken.id, tokenHash, expiresAt: { gt: new Date() } },
        });
        if (deleted.count !== 1) return { ok: false as const, reason: "invalid" as const };

        if (authToken.purpose === AuthTokenPurpose.EMAIL_CHANGE && !authToken.targetEmail) {
          return { ok: false as const, reason: "invalid" as const };
        }

        await tx.user.update({
          where: { id: authToken.userId },
          data: {
            email:
              authToken.purpose === AuthTokenPurpose.EMAIL_CHANGE
                ? authToken.targetEmail
                : undefined,
            emailVerifiedAt: new Date(),
          },
          select: { id: true },
        });

        return {
          ok: true as const,
          userId: authToken.userId,
          emailChanged: authToken.purpose === AuthTokenPurpose.EMAIL_CHANGE,
        };
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, reason: "email-taken" as const };
    }
    throw error;
  }
}

export async function consumePasswordResetToken(token: string, passwordHash: string) {
  const tokenHash = hashAuthToken(token);

  return prisma.$transaction(
    async (tx) => {
      const authToken = await tx.authToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, purpose: true, expiresAt: true },
      });
      if (
        !authToken ||
        authToken.purpose !== AuthTokenPurpose.PASSWORD_RESET ||
        authToken.expiresAt.getTime() <= Date.now()
      ) {
        return null;
      }

      const deleted = await tx.authToken.deleteMany({
        where: { id: authToken.id, tokenHash, expiresAt: { gt: new Date() } },
      });
      if (deleted.count !== 1) return null;

      await tx.user.update({
        where: { id: authToken.userId },
        data: { password: passwordHash },
        select: { id: true },
      });
      await tx.authToken.deleteMany({ where: { userId: authToken.userId } });
      return authToken.userId;
    },
  );
}
