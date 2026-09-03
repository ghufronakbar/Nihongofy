import "server-only";

import { AuthTokenPurpose, OAuthProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { GoogleIdentity } from "./google-oauth";

type GoogleAccountResult =
  | {
      ok: true;
      user: {
        id: number;
        deletionScheduledFor: Date | null;
      };
      created: boolean;
    }
  | {
      ok: false;
      reason:
        | "provider-conflict"
        | "email-mismatch"
        | "account-missing"
        | "credential-account"
        | "account-unavailable";
    };

const userAvailabilitySelect = {
  id: true,
  deletionScheduledFor: true,
} satisfies Prisma.UserSelect;

export async function loginWithGoogle(
  identity: GoogleIdentity,
): Promise<GoogleAccountResult> {
  const linkedAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: OAuthProvider.GOOGLE,
        providerAccountId: identity.providerAccountId,
      },
    },
    select: {
      id: true,
      providerEmail: true,
      user: { select: userAvailabilitySelect },
    },
  });
  if (linkedAccount) {
    if (linkedAccount.providerEmail !== identity.email) {
      await prisma.oAuthAccount.update({
        where: { id: linkedAccount.id },
        data: { providerEmail: identity.email },
        select: { id: true },
      });
    }
    return { ok: true, user: linkedAccount.user, created: false };
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { email: identity.email },
        select: {
          ...userAvailabilitySelect,
          password: true,
          oauthAccounts: {
            where: { provider: OAuthProvider.GOOGLE },
            select: { providerAccountId: true },
            take: 1,
          },
        },
      });

      if (user) {
        const googleAccount = user.oauthAccounts[0];
        if (googleAccount) {
          return googleAccount.providerAccountId === identity.providerAccountId
            ? {
                ok: true as const,
                user: {
                  id: user.id,
                  deletionScheduledFor: user.deletionScheduledFor,
                },
                created: false,
              }
            : { ok: false as const, reason: "provider-conflict" as const };
        }

        return user.password
          ? { ok: false as const, reason: "credential-account" as const }
          : { ok: false as const, reason: "account-unavailable" as const };
      }

      const createdUser = await transaction.user.create({
        data: {
          username: null,
          displayName: identity.displayName,
          email: identity.email,
          emailVerifiedAt: new Date(),
          avatarUrl: identity.pictureUrl,
          password: null,
          oauthAccounts: {
            create: {
              provider: OAuthProvider.GOOGLE,
              providerAccountId: identity.providerAccountId,
              providerEmail: identity.email,
            },
          },
        },
        select: userAvailabilitySelect,
      });

      return { ok: true as const, user: createdUser, created: true };
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const racedAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.GOOGLE,
          providerAccountId: identity.providerAccountId,
        },
      },
      select: { user: { select: userAvailabilitySelect } },
    });
    return racedAccount
      ? { ok: true, user: racedAccount.user, created: false }
      : { ok: false, reason: "provider-conflict" };
  }
}

export async function connectGoogleAccount(
  userId: number,
  identity: GoogleIdentity,
): Promise<GoogleAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userAvailabilitySelect,
      email: true,
      oauthAccounts: {
        where: { provider: OAuthProvider.GOOGLE },
        select: { providerAccountId: true },
        take: 1,
      },
    },
  });
  if (!user) return { ok: false, reason: "account-missing" };
  if (!user.email || user.email !== identity.email) {
    return { ok: false, reason: "email-mismatch" };
  }

  const existingProvider = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: OAuthProvider.GOOGLE,
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { userId: true },
  });
  if (existingProvider && existingProvider.userId !== userId) {
    return { ok: false, reason: "provider-conflict" };
  }
  if (user.oauthAccounts[0]) {
    return user.oauthAccounts[0].providerAccountId === identity.providerAccountId
      ? { ok: true, user, created: false }
      : { ok: false, reason: "provider-conflict" };
  }

  try {
    await prisma.$transaction([
      prisma.oAuthAccount.create({
        data: {
          userId,
          provider: OAuthProvider.GOOGLE,
          providerAccountId: identity.providerAccountId,
          providerEmail: identity.email,
        },
        select: { id: true },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
        select: { id: true },
      }),
      prisma.authToken.deleteMany({
        where: {
          userId,
          purpose: {
            in: [
              AuthTokenPurpose.EMAIL_VERIFICATION,
              AuthTokenPurpose.EMAIL_CHANGE,
            ],
          },
        },
      }),
    ]);
    return { ok: true, user, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "provider-conflict" };
    }
    throw error;
  }
}

export async function googleIdentityBelongsToUser(
  userId: number,
  providerAccountId: string,
) {
  const account = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: OAuthProvider.GOOGLE,
        providerAccountId,
      },
    },
    select: { userId: true },
  });
  return account?.userId === userId;
}
