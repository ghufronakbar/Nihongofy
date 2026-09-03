"use server";

import bcrypt from "bcryptjs";
import { AuthTokenPurpose, Prisma } from "@prisma/client";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { BCRYPT_COST_FACTOR } from "@/constants";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { createSignedUploadParams } from "@/lib/cloudinary";
import {
  createSession,
  getSession,
  listUserSessions,
  revokeAllUserSessions,
  revokeUserSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/features/auth/lib/send-auth-email";
import {
  consumeAuthRateLimits,
  getRequestIpAddress,
  type AuthRateLimitBucket,
} from "@/features/auth/lib/rate-limit";
import { RevokeSessionSchema } from "@/features/auth/schemas";
import {
  ChangePasswordSchema,
  UpdateProfileSchema,
  type ChangePasswordInput,
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
      const [kanaLearned, vocabularyStarted, practiceCompleted, examCompleted] =
        await Promise.all([
          prisma.kanaProgress.count({ where: { userId: id, correctCount: { gt: 0 } } }),
          prisma.flashcardProgress.count({ where: { userId: id } }),
          prisma.practiceSession.count({ where: { userId: id, status: "COMPLETED" } }),
          prisma.attempt.count({ where: { userId: id, status: "COMPLETED" } }),
        ]);

      return { kanaLearned, vocabularyStarted, practiceCompleted, examCompleted };
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
    email: validated.data.email.toLowerCase(),
    avatarUrl: validated.data.avatarUrl,
    currentPassword: "",
  };

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, password: true, displayName: true },
  });
  if (!currentUser) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const emailChanged = currentUser.email !== values.email;
  if (emailChanged) {
    const passwordValid = validated.data.currentPassword
      ? await bcrypt.compare(validated.data.currentPassword, currentUser.password)
      : false;
    if (!passwordValid) {
      return { ok: false, message: "Masukkan password saat ini untuk mengganti email." };
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email: values.email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== session.userId) {
      return { ok: false, message: "Email tersebut tidak dapat digunakan." };
    }
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { displayName: values.displayName, avatarUrl: values.avatarUrl },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        message: "Profil tidak dapat diperbarui. Periksa kembali email yang digunakan.",
      };
    }

    throw error;
  }

  updateTag(CACHE_TAGS.profileAccount(session.userId));
  revalidatePath("/(dashboard)", "layout");

  if (emailChanged) {
    const ipAddress = await getRequestIpAddress();
    const buckets: AuthRateLimitBucket[] = [
      {
        scope: "email-change:user",
        subject: String(session.userId),
        maxAttempts: 5,
        windowSeconds: 60 * 60,
        blockSeconds: 60 * 60,
      },
    ];
    if (ipAddress) {
      buckets.push({
        scope: "email-change:ip",
        subject: ipAddress,
        maxAttempts: 20,
        windowSeconds: 60 * 60,
        blockSeconds: 60 * 60,
      });
    }

    const rateLimit = await consumeAuthRateLimits(buckets);
    if (!rateLimit.allowed) {
      return {
        ok: false,
        message: "Profil tersimpan, tetapi batas pengiriman email tercapai. Coba lagi nanti.",
      };
    }

    try {
      const delivery = await sendVerificationEmail({
        userId: session.userId,
        email: values.email,
        displayName: values.displayName,
        purpose: AuthTokenPurpose.EMAIL_CHANGE,
      });
      if (!delivery.allowed) {
        return {
          ok: false,
          message: `Profil tersimpan. Tunggu ${delivery.retryAfterSeconds} detik sebelum meminta email perubahan lagi.`,
        };
      }
    } catch {
      return {
        ok: false,
        message: "Profil tersimpan, tetapi email konfirmasi belum dapat dikirim.",
      };
    }

    return {
      ok: true,
      message: "Profil tersimpan. Konfirmasikan perubahan melalui email baru Anda.",
      values: { ...values, email: currentUser.email ?? "" },
    };
  }

  return { ok: true, message: "Profil berhasil diperbarui.", values };
}

export async function getAvatarUploadSignatureAction() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  return createSignedUploadParams(`jlpt-exam/avatars/${session.userId}`);
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
  const currentPasswordValid = user
    ? await bcrypt.compare(validated.data.currentPassword, user.password)
    : false;

  if (!user || !currentPasswordValid) {
    return {
      ok: false,
      message: "Password tidak dapat diubah. Periksa password saat ini.",
    };
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
