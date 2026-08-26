"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath, unstable_cache, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { BCRYPT_COST_FACTOR } from "@/constants";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { createSignedUploadParams } from "@/lib/cloudinary";
import { createSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const values = {
    displayName: validated.data.displayName.replace(/\s+/g, " "),
    email: validated.data.email.toLowerCase(),
    avatarUrl: validated.data.avatarUrl,
  };

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: values,
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
  await prisma.user.update({
    where: { id: session.userId },
    data: { password: passwordHash },
    select: { id: true },
  });

  await createSession(session.userId);

  return {
    ok: true,
    message: "Password diperbarui dan sesi aktif sudah dirotasi.",
  };
}
