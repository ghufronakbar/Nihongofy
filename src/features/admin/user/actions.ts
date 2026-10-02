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
  SuspendUserPostingSchema,
  LiftUserPostingSuspensionSchema,
  type SetUserRoleInput,
  type RevokeUserSessionInput,
  type ResetUserRateLimitInput,
  type CancelUserDeletionInput,
  type SuspendUserPostingInput,
  type LiftUserPostingSuspensionInput,
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

/**
 * Rem darurat moderasi: user tidak dapat menulis ke diskusi publik pada target
 * mana pun (soal, kata, pola), tanpa menghapus akunnya. Catatan privat, konten
 * publik yang sudah ada, dan akses lain tidak berubah — konten lama tetap
 * ditakedown lewat /admin/moderation. Berlaku seketika karena status dibaca per
 * request oleh action diskusi.
 *
 * Admin tidak dapat men-suspend dirinya sendiri: tidak ada gunanya, dan kalau
 * ia satu-satunya admin, tidak ada yang dapat mencabutnya dari UI.
 */
export async function suspendUserPostingAction(
  input: SuspendUserPostingInput,
): Promise<UserActionResult> {
  const actor = await requireAdmin();

  const validated = SuspendUserPostingSchema.safeParse(input);
  if (!validated.success) {
    return { ok: false, message: validated.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const { userId, reason } = validated.data;
  if (userId === actor.user.id) {
    return { ok: false, message: "Tidak dapat membatasi posting akun sendiri." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, anonymizedAt: true, postingSuspendedAt: true },
  });
  if (!target) notFound();
  if (target.anonymizedAt) {
    return { ok: false, message: "Akun ini sudah dihapus; tidak ada yang perlu dibatasi." };
  }
  if (target.postingSuspendedAt) {
    return { ok: false, message: "Posting akun ini sudah dibatasi." };
  }

  await prisma.$transaction(async (tx) => {
    // `postingSuspendedAt: null` di where menutup balapan dua admin sekaligus:
    // yang kalah tidak menimpa alasan dan pelaku yang sudah tercatat.
    const updated = await tx.user.updateMany({
      where: { id: userId, postingSuspendedAt: null },
      data: {
        postingSuspendedAt: new Date(),
        postingSuspendedReason: reason,
        postingSuspendedById: actor.user.id,
      },
    });
    if (updated.count === 0) return;
    // Alasan sengaja tidak masuk summary: bisa memuat kutipan konten, dan baris
    // log bertahan lebih lama daripada datanya. Alasan tersimpan di baris User.
    await recordAdminActionTx(tx, {
      actor,
      action: "user.posting_suspend",
      targetType: "user",
      targetId: userId,
      summary: "Membatasi posting diskusi publik user ini.",
    });
  });
  return {
    ok: true,
    message:
      "Posting diskusi publik dibatasi. Berlaku seketika; konten lama tidak berubah — takedown lewat Moderasi bila perlu.",
  };
}

/** Mencabut suspend posting. Alasan dan pelaku lama ikut dikosongkan. */
export async function liftUserPostingSuspensionAction(
  input: LiftUserPostingSuspensionInput,
): Promise<UserActionResult> {
  const actor = await requireAdmin();

  const validated = LiftUserPostingSuspensionSchema.safeParse(input);
  if (!validated.success) return { ok: false, message: "Data tidak valid." };

  const { userId } = validated.data;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, postingSuspendedAt: true },
  });
  if (!target) notFound();
  if (!target.postingSuspendedAt) {
    return { ok: false, message: "Posting akun ini tidak sedang dibatasi." };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, postingSuspendedAt: { not: null } },
      data: {
        postingSuspendedAt: null,
        postingSuspendedReason: null,
        postingSuspendedById: null,
      },
    });
    if (updated.count === 0) return;
    await recordAdminActionTx(tx, {
      actor,
      action: "user.posting_unsuspend",
      targetType: "user",
      targetId: userId,
      summary: "Mencabut pembatasan posting diskusi publik user ini.",
    });
  });
  return { ok: true, message: "Pembatasan posting dicabut." };
}
