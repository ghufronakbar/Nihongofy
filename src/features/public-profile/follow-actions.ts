"use server";

import type { FollowStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { FEATURES, FOLLOW_RATE_LIMITS } from "@/constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRetryAfter } from "@/lib/rate-limit";
import { limitByRedis } from "@/lib/redis-rate-limit";
import { initialFollowStatus, isProfileUnavailable } from "./access";
import {
  FollowRequestResponseSchema,
  RemoveFollowerSchema,
  SetFollowSchema,
  type FollowRequestResponseInput,
  type RemoveFollowerInput,
  type SetFollowInput,
} from "./schemas";

export type FollowActionResult =
  | { ok: true; status: FollowStatus | null }
  | { ok: false; message: string };

export type FollowManageResult = { ok: true } | { ok: false; message: string };

// Penolakan dikembalikan, bukan dilempar, supaya pesan rate limit sampai ke
// user (pesan error Server Action disamarkan di produksi). Input tidak valid
// tetap `notFound()`, sama seperti action diskusi.

/**
 * Mengikuti atau berhenti mengikuti. `following` adalah keadaan yang diinginkan,
 * bukan toggle, jadi klik ganda dan retry idempoten. Berhenti mengikuti juga
 * membatalkan permintaan yang masih PENDING.
 */
export async function setFollowAction(input: SetFollowInput): Promise<FollowActionResult> {
  if (!FEATURES.follow) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu untuk mengikuti akun ini." };

  const parsed = SetFollowSchema.safeParse(input);
  if (!parsed.success) notFound();

  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, profileVisibility: true, anonymizedAt: true, deletionRequestedAt: true },
  });
  if (!target || isProfileUnavailable(target)) {
    return { ok: false, message: "Akun ini tidak tersedia." };
  }
  if (target.id === session.userId) {
    return { ok: false, message: "Kamu tidak bisa mengikuti akunmu sendiri." };
  }

  const pair = { followerId: session.userId, followingId: target.id };

  if (!parsed.data.following) {
    await prisma.follow.deleteMany({ where: pair });
    return { ok: true, status: null };
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: pair },
    select: { status: true },
  });
  if (existing) return { ok: true, status: existing.status };

  const limit = await limitByRedis("follow", session.userId, FOLLOW_RATE_LIMITS);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Terlalu banyak follow dalam waktu singkat. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }

  // skipDuplicates: dua tab yang menekan Follow bersamaan menjadi satu baris.
  await prisma.follow.createMany({
    data: [{ ...pair, status: initialFollowStatus(target.profileVisibility) }],
    skipDuplicates: true,
  });
  const created = await prisma.follow.findUnique({
    where: { followerId_followingId: pair },
    select: { status: true },
  });
  return { ok: true, status: created?.status ?? null };
}

/** Pemilik akun menyetujui atau menolak satu permintaan follow masuk. */
export async function respondFollowRequestAction(
  input: FollowRequestResponseInput,
): Promise<FollowManageResult> {
  if (!FEATURES.follow) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const parsed = FollowRequestResponseSchema.safeParse(input);
  if (!parsed.success) notFound();

  // Selalu dibatasi ke permintaan MILIK session: id follower dari client hanya
  // memilih baris, tidak pernah memberi wewenang.
  const where = { followerId: parsed.data.followerId, followingId: session.userId, status: "PENDING" as const };
  if (parsed.data.accept) {
    await prisma.follow.updateMany({ where, data: { status: "ACCEPTED", respondedAt: new Date() } });
  } else {
    await prisma.follow.deleteMany({ where });
  }

  // Badge jumlah permintaan ada di layout dashboard.
  revalidatePath("/(dashboard)", "layout");
  return { ok: true };
}

/** Pemilik akun menghapus seorang follower (atau permintaannya). */
export async function removeFollowerAction(input: RemoveFollowerInput): Promise<FollowManageResult> {
  if (!FEATURES.follow) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const parsed = RemoveFollowerSchema.safeParse(input);
  if (!parsed.success) notFound();

  await prisma.follow.deleteMany({
    where: { followerId: parsed.data.followerId, followingId: session.userId },
  });

  revalidatePath("/(dashboard)", "layout");
  return { ok: true };
}
