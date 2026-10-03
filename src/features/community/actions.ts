"use server";

import { notFound } from "next/navigation";
import { FEATURES, POST_LIKE_RATE_LIMITS, POST_WRITE_RATE_LIMITS } from "@/constants";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAllowedCommentImageUrl } from "@/lib/r2";
import { formatRetryAfter } from "@/lib/rate-limit";
import { limitByRedis } from "@/lib/redis-rate-limit";
import { isPostingSuspended } from "@/features/question-comment/queries";
import { getPostAccess } from "./queries";
import {
  CreatePostSchema,
  DeletePostSchema,
  LikePostSchema,
  UpdatePostSchema,
  type CreatePostInput,
  type DeletePostInput,
  type LikePostInput,
  type UpdatePostInput,
} from "./schemas";

// Penolakan yang perlu dibaca user (rate limit, akun dibatasi) dikembalikan
// sebagai pesan, bukan dilempar: pesan error Server Action disamarkan di
// produksi. Input tidak valid dan akses terlarang tetap `notFound()`.

export type PostActionResult = { ok: true } | { ok: false; message: string };
export type CreatePostResult = { ok: true; postId: number } | { ok: false; message: string };
export type LikePostResult = { ok: true; liked: boolean; likeCount: number } | { ok: false; message: string };

const SUSPENDED_MESSAGE =
  "Akun Anda sedang dibatasi dari konten publik: tidak dapat membuat, menyunting, atau mengomentari postingan.";

// Gambar postingan memakai jalur upload komentar, jadi pemeriksaan kepemilikannya
// juga sama: hanya object milik user ini di bucket kita.
function requireOwnedImages(images: string[], userId: number) {
  if (!images.every((url) => isAllowedCommentImageUrl(url, userId))) notFound();
}

async function checkWriteLimit(userId: number): Promise<{ ok: false; message: string } | null> {
  const limit = await limitByRedis("post-write", userId, POST_WRITE_RATE_LIMITS);
  if (limit.allowed) return null;
  return {
    ok: false,
    message: `Terlalu banyak postingan dalam waktu singkat. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
  };
}

/** Postingan milik session yang masih hidup; selain itu 404. */
async function requireOwnLivePost(postId: number, userId: number) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!post || post.userId !== userId || post.deletedAt) notFound();
  return post;
}

/**
 * Postingan baru. Akun private boleh memposting; postingannya hanya terlihat
 * oleh pemilik dan follower yang disetujui, dan tidak masuk feed global.
 */
export async function createPostAction(input: CreatePostInput): Promise<CreatePostResult> {
  if (!FEATURES.community) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu untuk membuat postingan." };

  const parsed = CreatePostSchema.safeParse(input);
  if (!parsed.success) notFound();
  requireOwnedImages(parsed.data.images, session.userId);

  if (await isPostingSuspended(session.userId)) return { ok: false, message: SUSPENDED_MESSAGE };

  const limited = await checkWriteLimit(session.userId);
  if (limited) return limited;

  const post = await prisma.post.create({
    data: { userId: session.userId, text: parsed.data.text, images: parsed.data.images },
    select: { id: true },
  });
  return { ok: true, postId: post.id };
}

export async function updatePostAction(input: UpdatePostInput): Promise<PostActionResult> {
  if (!FEATURES.community) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const parsed = UpdatePostSchema.safeParse(input);
  if (!parsed.success) notFound();
  requireOwnedImages(parsed.data.images, session.userId);
  await requireOwnLivePost(parsed.data.postId, session.userId);

  // Menyunting postingan sama dengan menerbitkan isi baru.
  if (await isPostingSuspended(session.userId)) return { ok: false, message: SUSPENDED_MESSAGE };

  const limited = await checkWriteLimit(session.userId);
  if (limited) return limited;

  await prisma.post.update({
    where: { id: parsed.data.postId },
    data: { text: parsed.data.text, images: parsed.data.images, editedAt: new Date() },
    select: { id: true },
  });
  return { ok: true };
}

/**
 * Selalu soft delete. Komentar orang lain menempel pada postingan ini; postingan
 * yang punya komentar menjadi tombstone. Tidak dibatasi rate limit maupun
 * suspend: menarik tulisan sendiri harus selalu bisa.
 */
export async function deletePostAction(input: DeletePostInput): Promise<PostActionResult> {
  if (!FEATURES.community) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." };

  const parsed = DeletePostSchema.safeParse(input);
  if (!parsed.success) notFound();
  await requireOwnLivePost(parsed.data.postId, session.userId);

  await prisma.post.update({
    where: { id: parsed.data.postId },
    // deletedById = pemilik: moderasi membedakannya dari takedown admin, dan
    // hanya takedown admin yang boleh dipulihkan.
    data: { deletedAt: new Date(), deletedById: session.userId },
    select: { id: true },
  });
  return { ok: true };
}

/**
 * Memberi atau menarik like. Ditolak untuk postingan sendiri, postingan yang
 * dihapus, dan postingan yang tidak boleh dilihat viewer (akun private tanpa
 * follow yang disetujui). Menarik like selalu boleh.
 */
export async function likePostAction(input: LikePostInput): Promise<LikePostResult> {
  if (!FEATURES.community) notFound();

  const session = await getSession();
  if (!session) return { ok: false, message: "Masuk dulu untuk menyukai postingan." };

  const parsed = LikePostSchema.safeParse(input);
  if (!parsed.success) notFound();
  const { postId, liked } = parsed.data;
  const userId = session.userId;

  if (liked) {
    const access = await getPostAccess(postId, userId);
    if (!access || access.deletedAt || !access.canView) notFound();
    if (access.authorId === userId) {
      return { ok: false, message: "Tidak bisa menyukai postingan sendiri." };
    }
  }

  const limit = await limitByRedis("post-like", userId, POST_LIKE_RATE_LIMITS);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Terlalu banyak like dalam waktu singkat. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }

  if (liked) {
    await prisma.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true });
  } else {
    await prisma.postLike.deleteMany({ where: { postId, userId } });
  }

  const likeCount = await prisma.postLike.count({ where: { postId } });
  return { ok: true, liked, likeCount };
}
