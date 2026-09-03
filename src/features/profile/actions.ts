"use server";

import bcrypt from "bcryptjs";
import { OAuthProvider, Prisma } from "@prisma/client";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { BCRYPT_COST_FACTOR } from "@/constants";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import {
  createSignedAvatarUploadParams,
  destroyManagedAvatar,
  scheduleAvatarCleanup,
  unscheduleAvatarCleanup,
  verifyManagedAvatar,
} from "@/lib/cloudinary";
import {
  createSession,
  getSession,
  listUserSessions,
  revokeAllUserSessions,
  revokeUserSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeGoogleOAuthReauthProof } from "@/features/auth/lib/google-oauth-state";
import { RevokeSessionSchema } from "@/features/auth/schemas";
import { reportServerError } from "@/lib/server-logger";
import {
  completedMockAttemptWhere,
  completedQuickPracticeWhere,
  completedSectionAttemptWhere,
} from "@/lib/activity-metrics";
import {
  ChangePasswordSchema,
  DisconnectGoogleSchema,
  SetPasswordSchema,
  UpdateProfileSchema,
  type ChangePasswordInput,
  type DisconnectGoogleInput,
  type SetPasswordInput,
  type UpdateProfileInput,
} from "./schemas";

export type ProfileActionResult =
  | { ok: true; message: string; values: UpdateProfileInput }
  | { ok: false; message: string };

export type PasswordActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const getCachedProfileAccount = (userId: number) =>
  unstable_cache(
    async (id: number) => {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          displayName: true,
          email: true,
          username: true,
          avatarUrl: true,
          avatarPublicId: true,
          timeZone: true,
          createdAt: true,
        },
      });

      return user
        ? { ...user, createdAt: user.createdAt.toISOString() }
        : null;
    },
    CACHE_KEYS.profileAccount(userId),
    { tags: [CACHE_TAGS.profileAccount(userId)] },
  )(userId);

const getCachedProfileOverview = (userId: number) =>
  unstable_cache(
    async (id: number) => {
      const [
        kanaLearned,
        vocabularyStarted,
        quickPracticeCompleted,
        sectionPracticeCompleted,
        mockCompleted,
      ] =
        await Promise.all([
          prisma.kanaProgress.count({ where: { userId: id, correctCount: { gt: 0 } } }),
          prisma.flashcardProgress.count({ where: { userId: id } }),
          prisma.practiceSession.count({ where: completedQuickPracticeWhere(id) }),
          prisma.attempt.count({ where: completedSectionAttemptWhere(id) }),
          prisma.attempt.count({ where: completedMockAttemptWhere(id) }),
        ]);

      return {
        kanaLearned,
        vocabularyStarted,
        quickPracticeCompleted,
        sectionPracticeCompleted,
        mockCompleted,
      };
    },
    CACHE_KEYS.profileOverview(userId),
    { tags: [CACHE_TAGS.profileOverview(userId)] },
  )(userId);

export async function getProfileAccountAction() {
  const session = await getSession();
  if (!session) redirect("/login");

  const account = await getCachedProfileAccount(session.userId);
  if (!account) redirect("/login");

  return account;
}

export async function getProfileOverviewAction() {
  const session = await getSession();
  if (!session) redirect("/login");

  return getCachedProfileOverview(session.userId);
}

export async function getSecurityAccountAction() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      username: true,
      password: true,
      timeZone: true,
      oauthAccounts: {
        where: { provider: OAuthProvider.GOOGLE },
        select: { providerEmail: true },
        take: 1,
      },
    },
  });
  if (!user) redirect("/login");

  return {
    email: user.email,
    username: user.username,
    hasPassword: Boolean(user.password),
    timeZone: user.timeZone,
    googleAccountEmail: user.oauthAccounts[0]?.providerEmail ?? null,
  };
}

export async function updateProfileAction(
  input: UpdateProfileInput,
): Promise<ProfileActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = UpdateProfileSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Data profil tidak valid.",
    };
  }

  const values: UpdateProfileInput = {
    displayName: validated.data.displayName.replace(/\s+/g, " "),
    avatarUrl: validated.data.avatarUrl,
    avatarPublicId: validated.data.avatarPublicId,
    timeZone: validated.data.timeZone,
  };

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      avatarUrl: true,
      avatarPublicId: true,
      avatarFormat: true,
      avatarBytes: true,
    },
  });
  if (!currentUser) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const avatarChanged =
    values.avatarUrl !== currentUser.avatarUrl ||
    values.avatarPublicId !== currentUser.avatarPublicId;
  let avatar = {
    avatarUrl: currentUser.avatarUrl,
    avatarPublicId: currentUser.avatarPublicId,
    avatarFormat: currentUser.avatarFormat,
    avatarBytes: currentUser.avatarBytes,
  };

  if (avatarChanged) {
    if (values.avatarUrl === null && values.avatarPublicId === null) {
      avatar = {
        avatarUrl: null,
        avatarPublicId: null,
        avatarFormat: null,
        avatarBytes: null,
      };
    } else if (values.avatarUrl && values.avatarPublicId) {
      try {
        const verifiedAvatar = await verifyManagedAvatar({
          userId: session.userId,
          publicId: values.avatarPublicId,
          secureUrl: values.avatarUrl,
        });
        if (!verifiedAvatar) {
          return { ok: false, message: "Avatar tidak dapat diverifikasi sebagai upload akun ini." };
        }
        avatar = {
          avatarUrl: verifiedAvatar.url,
          avatarPublicId: verifiedAvatar.publicId,
          avatarFormat: verifiedAvatar.format,
          avatarBytes: verifiedAvatar.bytes,
        };
      } catch (error) {
        reportServerError("profile.avatar_verification_failed", error);
        return { ok: false, message: "Avatar belum dapat diverifikasi. Coba lagi." };
      }
    } else {
      return { ok: false, message: "Metadata avatar tidak lengkap." };
    }
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        displayName: values.displayName,
        ...avatar,
        timeZone: values.timeZone,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        message: "Avatar tersebut sudah digunakan atau profil tidak dapat diperbarui.",
      };
    }

    throw error;
  }

  if (avatarChanged && avatar.avatarPublicId) {
    try {
      await unscheduleAvatarCleanup(avatar.avatarPublicId);
    } catch (error) {
      reportServerError("profile.avatar_cleanup_unschedule_failed", error);
    }
  }

  if (
    avatarChanged &&
    currentUser.avatarPublicId &&
    currentUser.avatarPublicId !== avatar.avatarPublicId
  ) {
    try {
      await destroyManagedAvatar(currentUser.avatarPublicId);
      await unscheduleAvatarCleanup(currentUser.avatarPublicId);
    } catch (error) {
      await scheduleAvatarCleanup(currentUser.avatarPublicId).catch((scheduleError: unknown) => {
        reportServerError("profile.avatar_cleanup_schedule_failed", scheduleError);
      });
      reportServerError("profile.avatar_destroy_failed", error);
    }
  }

  updateTag(CACHE_TAGS.profileAccount(session.userId));
  revalidatePath("/(dashboard)", "layout");

  return { ok: true, message: "Profil berhasil diperbarui.", values };
}

export async function getAvatarUploadSignatureAction() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  return createSignedAvatarUploadParams(session.userId);
}

export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<PasswordActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = ChangePasswordSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Data password tidak valid.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  });
  const currentPasswordValid = user?.password
    ? await bcrypt.compare(validated.data.currentPassword, user.password)
    : false;

  if (!user || !currentPasswordValid) {
    return {
      ok: false,
      message: "Password tidak dapat diubah. Periksa password saat ini.",
    };
  }

  if (!user.password) {
    return { ok: false, message: "Akun belum memiliki password." };
  }

  const newMatchesCurrent = await bcrypt.compare(validated.data.newPassword, user.password);
  if (newMatchesCurrent) {
    return { ok: false, message: "Gunakan password baru yang berbeda." };
  }

  const passwordHash = await bcrypt.hash(validated.data.newPassword, BCRYPT_COST_FACTOR);
  await revokeAllUserSessions(session.userId);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: { password: passwordHash },
      select: { id: true },
    }),
    prisma.authToken.deleteMany({ where: { userId: session.userId } }),
  ]);

  await createSession(session.userId);

  return {
    ok: true,
    message: "Password diperbarui dan sesi aktif sudah dirotasi.",
  };
}

export async function setPasswordAction(
  input: SetPasswordInput,
): Promise<PasswordActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = SetPasswordSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Data password tidak valid.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      password: true,
      oauthAccounts: {
        where: { provider: OAuthProvider.GOOGLE },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };
  if (user.password) return { ok: false, message: "Akun sudah memiliki password." };
  if (!user.oauthAccounts[0]) {
    return { ok: false, message: "Google account belum terhubung." };
  }

  const reauthenticated = await consumeGoogleOAuthReauthProof({
    userId: session.userId,
    purpose: "set-password",
  });
  if (!reauthenticated) {
    return { ok: false, message: "Verifikasi Google berakhir. Verifikasi ulang dahulu." };
  }

  const passwordHash = await bcrypt.hash(validated.data.newPassword, BCRYPT_COST_FACTOR);
  await revokeAllUserSessions(session.userId);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: { password: passwordHash },
      select: { id: true },
    }),
    prisma.authToken.deleteMany({ where: { userId: session.userId } }),
  ]);
  await createSession(session.userId);
  revalidatePath("/profile/security");

  return { ok: true, message: "Password berhasil dibuat dan sesi aktif sudah dirotasi." };
}

export async function disconnectGoogleAction(
  input: DisconnectGoogleInput,
): Promise<PasswordActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = DisconnectGoogleSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Password wajib diisi.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  });
  const passwordValid = user?.password
    ? await bcrypt.compare(validated.data.currentPassword, user.password)
    : false;
  if (!user?.password || !passwordValid) {
    return { ok: false, message: "Password saat ini tidak cocok." };
  }

  const deleted = await prisma.oAuthAccount.deleteMany({
    where: { userId: session.userId, provider: OAuthProvider.GOOGLE },
  });
  if (deleted.count === 0) {
    return { ok: false, message: "Google account sudah tidak terhubung." };
  }

  await revokeAllUserSessions(session.userId, session.sessionId);
  revalidatePath("/profile/security");
  return { ok: true, message: "Google account berhasil diputuskan." };
}

export async function getActiveSessionsAction() {
  const session = await getSession();
  if (!session) redirect("/login");

  const sessions = await listUserSessions(session.userId);
  return sessions.map((item) => ({
    ...item,
    current: item.sessionId === session.sessionId,
  }));
}

export async function revokeSessionAction(input: unknown) {
  const session = await getSession();
  if (!session) return { ok: false as const, message: "Sesi berakhir. Silakan masuk lagi." };

  const validated = RevokeSessionSchema.safeParse(input);
  if (!validated.success || validated.data.sessionId === session.sessionId) {
    return { ok: false as const, message: "Session tidak dapat dicabut dari aksi ini." };
  }

  const revoked = await revokeUserSession(session.userId, validated.data.sessionId);
  if (!revoked) return { ok: false as const, message: "Session sudah tidak aktif." };

  revalidatePath("/profile/security");
  return { ok: true as const, message: "Perangkat berhasil dikeluarkan." };
}

export async function logoutOtherSessionsAction() {
  const session = await getSession();
  if (!session) return { ok: false as const, message: "Sesi berakhir. Silakan masuk lagi." };

  const revokedCount = await revokeAllUserSessions(session.userId, session.sessionId);
  revalidatePath("/profile/security");
  return {
    ok: true as const,
    message:
      revokedCount > 0
        ? `${revokedCount} perangkat lain berhasil dikeluarkan.`
        : "Tidak ada perangkat lain yang aktif.",
  };
}
