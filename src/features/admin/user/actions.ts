"use server";

import { notFound } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, revokeAllUserSessions, revokeUserSession } from "@/lib/auth";
import { clearAuthRateLimits, type AuthRateLimitBucket } from "@/features/auth/lib/rate-limit";
import { recordAdminAction, recordAdminActionTx } from "../audit";
import { CACHE_TAGS } from "@/constants/cache-key";
import {
  SetUserRoleSchema,
  RevokeUserSessionSchema,
  ResetUserRateLimitSchema,
  CancelUserDeletionSchema,
  type SetUserRoleInput,
  type RevokeUserSessionInput,
  type ResetUserRateLimitInput,
  type CancelUserDeletionInput,
} from "./schemas";

export type UserActionResult = { ok: true; message?: string } | { ok: false; message: string };

/**
 * Mengubah role. Dua penjagaan, keduanya soal tidak mengunci diri sendiri:
 *
 * - Admin tidak dapat menurunkan dirinya sendiri. Efeknya langsung terasa
 *   karena role dibaca per request, jadi ia akan kehilangan akses di tengah
 *   pekerjaan tanpa cara mengembalikannya dari UI.
 * - Admin terakhir tidak dapat diturunkan. Tanpa admin sama sekali, satu-satunya
 *   jalan kembali adalah `npm run user:role` dengan akses shell ke database.
 *   Aturan yang sama ditegakkan script itu.
 */
export async function setUserRoleAction(input: SetUserRoleInput): Promise<UserActionResult> {
  const actor = await requireAdmin();

  const validated = SetUserRoleSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const { userId, role } = validated.data;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, displayName: true },
  });
  if (!target) notFound();

  if (target.role === role) return { ok: true, message: "Tidak ada perubahan." };

  if (role === "USER") {
    if (target.id === actor.user.id) {
      return {
        ok: false,
        message:
          "Tidak dapat menurunkan role sendiri. Role dibaca per request, jadi kamu akan langsung kehilangan akses tanpa cara kembali dari UI.",
      };
    }

    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return { ok: false, message: "Ini admin terakhir. Angkat admin lain lebih dulu." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role } });
    await recordAdminActionTx(tx, {
      actor,
      action: "user.role",
      targetType: "user",
      targetId: userId,
      summary: `Mengubah role ${target.displayName} dari ${target.role} menjadi ${role}.`,
    });
  });
  return {
    ok: true,
    message: `${target.displayName} sekarang ${role}. Berlaku seketika tanpa login ulang.`,
  };
}

/**
 * Mencabut session lewat helper di `src/lib/auth.ts`, bukan dengan menyentuh key
 * Redis langsung: registry itu punya indeks sorted-set yang harus ikut bersih.
 */
export async function revokeUserSessionAction(
  input: RevokeUserSessionInput,
): Promise<UserActionResult> {
  const actor = await requireAdmin();

  const validated = RevokeUserSessionSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const { userId, sessionId } = validated.data;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) notFound();

  if (sessionId) {
    // Mencabut session yang sedang dipakai admin ini sendiri berarti logout di
    // tengah pekerjaan. Boleh, tetapi harus disengaja — bukan efek samping dari
    // membersihkan daftar perangkat orang lain.
    if (sessionId === actor.sessionId) {
      return {
        ok: false,
        message: "Itu session yang sedang kamu pakai. Keluar lewat menu akun bila memang ingin.",
      };
    }

    const revoked = await revokeUserSession(userId, sessionId);
    if (!revoked) return { ok: false, message: "Session sudah tidak ada." };

    // Efeknya di Redis, bukan database, jadi tidak ada transaksi yang dapat
    // memayungi mutasi dan lognya sekaligus.
    await recordAdminAction({
      actor,
      action: "user.session_revoke",
      targetType: "user",
      targetId: userId,
      summary: "Mencabut satu session milik user.",
    });
    return { ok: true, message: "Session dicabut." };
  }

  await revokeAllUserSessions(userId, userId === actor.user.id ? actor.sessionId : undefined);
  await recordAdminAction({
    actor,
    action: "user.session_revoke_all",
    targetType: "user",
    targetId: userId,
    summary:
      userId === actor.user.id
        ? "Mencabut seluruh session sendiri kecuali yang sedang dipakai."
        : "Mencabut seluruh session milik user.",
  });
  return {
    ok: true,
    message:
      userId === actor.user.id
        ? "Seluruh session lain milikmu dicabut; session ini dipertahankan."
        : "Seluruh session user dicabut.",
  };
}

/**
 * Mengosongkan bucket rate limit yang mengunci satu akun.
 *
 * Bucket beridentitas IP sengaja tidak ikut: `AuthRateLimit` hanya menyimpan
 * HMAC dari scope dan subject, dan alamat IP mentah memang tidak pernah
 * disimpan di mana pun. Jadi bucket IP tidak dapat ditemukan dari sisi user dan
 * akan hilang sendiri setelah jendelanya lewat.
 */
export async function resetUserRateLimitAction(
  input: ResetUserRateLimitInput,
): Promise<UserActionResult> {
  const actor = await requireAdmin();

  const validated = ResetUserRateLimitSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const { userId } = validated.data;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });
  if (!user) notFound();

  // Nilai maxAttempts/windowSeconds/blockSeconds tidak dipakai saat menghapus —
  // `clearAuthRateLimits` hanya memakai scope dan subject untuk menurunkan
  // HMAC-nya, lewat fungsi yang sama yang membuat key-nya saat dikonsumsi.
  const identifiers = [user.email, user.username].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  const buckets: AuthRateLimitBucket[] = [];
  const push = (scope: string, subject: string) =>
    buckets.push({ scope, subject, maxAttempts: 0, windowSeconds: 0, blockSeconds: 0 });

  for (const identifier of identifiers) {
    push("login:identifier", identifier.toLowerCase());
    push("register:email", identifier.toLowerCase());
    push("forgot-password:email", identifier.toLowerCase());
  }
  push("verification:user", String(user.id));
  push("account-deletion-request:user", String(user.id));
  push("account-deletion-cancel:user", String(user.id));

  await clearAuthRateLimits(buckets);
  await recordAdminAction({
    actor,
    action: "user.rate_limit_reset",
    targetType: "user",
    targetId: user.id,
    summary: `Mengosongkan ${buckets.length} bucket rate limit yang terikat akun ini.`,
  });
  return {
    ok: true,
    message:
      "Bucket yang terikat akun ini dikosongkan. Bucket per alamat IP tidak ikut — IP mentah memang tidak disimpan, dan bucket itu hilang sendiri setelah jendelanya lewat.",
  };
}

/**
 * Membatalkan jadwal penghapusan akun. Tidak pernah menjadwalkannya: permintaan
 * menghapus akun adalah keputusan pemiliknya, dan admin tidak mewakilinya.
 */
export async function cancelUserDeletionAction(
  input: CancelUserDeletionInput,
): Promise<UserActionResult> {
  const actor = await requireAdmin();

  const validated = CancelUserDeletionSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const { userId } = validated.data;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletionScheduledFor: true },
  });
  if (!user) notFound();
  if (!user.deletionScheduledFor) {
    return { ok: false, message: "Akun ini tidak sedang dijadwalkan untuk dihapus." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: null, deletionScheduledFor: null },
    });
    await recordAdminActionTx(tx, {
      actor,
      action: "user.cancel_deletion",
      targetType: "user",
      targetId: userId,
      summary: "Membatalkan jadwal penghapusan akun.",
    });
  });

  // Halaman profil user membaca status ini dari cache per user.
  updateTag(CACHE_TAGS.profileAccount(userId));
  return { ok: true, message: "Jadwal penghapusan dibatalkan." };
}
