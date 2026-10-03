"use server";

import { notFound, redirect } from "next/navigation";
import {
  COMMENT_IMAGE_UPLOAD_RATE_LIMITS,
  COMMENT_VOTE_RATE_LIMITS,
  COMMENT_WRITE_RATE_LIMITS,
  FEATURES,
} from "@/constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createCommentImageUpload, isAllowedCommentImageUrl } from "@/lib/r2";
import { formatRetryAfter } from "@/lib/rate-limit";
import { limitByRedis } from "@/lib/redis-rate-limit";
import { getPostAccess } from "@/features/community/queries";
import {
  countVotes,
  getDiscussion,
  getOwnVocabNotes,
  isPostingSuspended,
  withViewerVotes,
  type DiscussionRoot,
  type OwnNote,
} from "./queries";
import {
  AddQuestionCommentSchema,
  EditQuestionCommentSchema,
  DeleteQuestionCommentSchema,
  ReplyQuestionCommentSchema,
  SetQuestionCommentVisibilitySchema,
  GetDiscussionSchema,
  GetOwnVocabNotesSchema,
  CreateCommentImageUploadSchema,
  VoteQuestionCommentSchema,
  type AddQuestionCommentInput,
  type EditQuestionCommentInput,
  type DeleteQuestionCommentInput,
  type ReplyQuestionCommentInput,
  type SetQuestionCommentVisibilityInput,
  type GetDiscussionInput,
  type GetOwnVocabNotesInput,
  type CreateCommentImageUploadInput,
  type VoteQuestionCommentInput,
} from "./schemas";
import { targetColumns, targetOf, type CommentTarget } from "./target";
import { voteRejection } from "./votes";

/**
 * Hasil aksi tulis. Penolakan yang perlu dibaca user (rate limit, akun
 * dibatasi) dikembalikan sebagai pesan, bukan dilempar: pesan error Server
 * Action disamarkan di produksi. Input tidak valid dan akses terlarang tetap
 * `notFound()`/throw.
 */
export type CommentActionResult = { ok: true } | { ok: false; message: string };

/** Thread satu target beserta status viewer yang memengaruhi form-nya. */
export type DiscussionThreadData = {
  roots: DiscussionRoot[];
  /** Viewer login yang di-suspend admin: form diskusi diganti keterangan. */
  postingSuspended: boolean;
};

// ============================================================
// FLAG PER TARGET
// ============================================================

// Catatan dan diskusi soal punya dua flag; untuk kata flashcard dan pola
// bunpou keduanya menumpang satu flag per modul (`FEATURES_FLASHCARD_DISCUSSION`,
// `FEATURES_BUNPOU_DISCUSSION`).
function notesEnabled(target: CommentTarget) {
  switch (target.type) {
    case "question":
      return FEATURES.questionComment;
    case "vocab":
      return FEATURES.flashcardDiscussion;
    case "bunpou":
      return FEATURES.bunpouDiscussion;
    // Postingan tidak punya catatan privat; flag ini hanya menjaga komentar publiknya.
    case "post":
      return FEATURES.community;
  }
}

function discussionEnabled(target: CommentTarget) {
  switch (target.type) {
    case "question":
      return FEATURES.questionDiscussion;
    case "vocab":
      return FEATURES.flashcardDiscussion;
    case "bunpou":
      return FEATURES.bunpouDiscussion;
    case "post":
      return FEATURES.community;
  }
}

// ============================================================
// PENJAGA BERSAMA
// ============================================================

// Gambar komentar disimpan sebagai URL biasa, jadi tanpa cek ini user bisa
// menyimpan URL bucket milik orang lain atau host sembarang ke dalam komentarnya.
// URL Cloudinary lama tetap lolos supaya komentar sebelum migrasi masih bisa disunting.
function requireOwnedCommentImages(commentImages: string[], userId: number) {
  if (!commentImages.every((url) => isAllowedCommentImageUrl(url, userId))) {
    throw new Error("Gambar komentar tidak valid.");
  }
}

/**
 * Komentar postingan mengikuti aturan akses postingannya: postingan akun private
 * hanya terbuka bagi pemilik dan follower yang disetujui. Tanpa cek ini, siapa
 * pun yang menebak id postingan dapat membaca atau menulis di thread-nya.
 *
 * `allowDeleted` untuk jalur baca: postingan yang dihapus tetap tampil sebagai
 * tombstone selama komentarnya ada, tetapi thread-nya read-only.
 */
async function requirePostAccess(
  target: CommentTarget,
  viewerId: number | null,
  { allowDeleted = false }: { allowDeleted?: boolean } = {},
) {
  if (target.type !== "post") return;
  const access = await getPostAccess(target.postId, viewerId);
  if (!access || !access.canView || (access.deletedAt && !allowDeleted)) notFound();
}

// Kata dan pola yang sudah pensiun dari katalog tetap menyimpan catatan lamanya,
// tetapi tidak menerima catatan baru. Postingan yang dihapus juga tidak.
async function ensureTargetExists(target: CommentTarget, viewerId: number) {
  switch (target.type) {
    case "question": {
      const question = await prisma.question.findUnique({
        where: { id: target.questionId },
        select: { id: true },
      });
      if (!question) notFound();
      return;
    }
    case "vocab": {
      const vocab = await prisma.flashcardVocab.findUnique({
        where: { id: target.vocabId },
        select: { retiredAt: true },
      });
      if (!vocab || vocab.retiredAt) notFound();
      return;
    }
    case "bunpou": {
      const point = await prisma.bunpouPoint.findUnique({
        where: { id: target.bunpouPointId },
        select: { retiredAt: true },
      });
      if (!point || point.retiredAt) notFound();
      return;
    }
    case "post":
      await requirePostAccess(target, viewerId);
      return;
  }
}

const commentTargetSelect = { questionId: true, vocabId: true, bunpouPointId: true, postId: true } as const;

// Comment yang sudah di-soft delete diperlakukan seperti tidak ada: hanya
// tombstone-nya yang dirender, dan tidak boleh diedit, dibagikan, atau dibalas.
async function requireOwnLiveComment(commentId: number, userId: number) {
  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      parentId: true,
      deletedAt: true,
      sharedAt: true,
      visibility: true,
      ...commentTargetSelect,
    },
  });

  if (!comment || comment.userId !== userId || comment.deletedAt) notFound();
  const target = targetOf(comment);
  if (!target) notFound();
  return { ...comment, target };
}

// Satu kuota untuk semua tulisan (buat, balas, sunting, bagikan) di soal maupun
// flashcard: yang dicegah adalah satu akun membanjiri diskusi.
async function checkWriteLimit(userId: number): Promise<CommentActionResult | null> {
  const limit = await limitByRedis("comment-write", userId, COMMENT_WRITE_RATE_LIMITS);
  if (limit.allowed) return null;
  return {
    ok: false,
    message: `Terlalu banyak catatan dalam waktu singkat. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
  };
}

// Rem darurat dari admin (`User.postingSuspendedAt`). Hanya jalur yang menulis
// ke diskusi publik yang dibatasi: catatan privat, menghapus, dan menarik
// kembali ke privat tetap jalan. Konten publik lama tidak disentuh — takedown
// tetap urusan /admin/moderation.
async function checkPublicPostingAllowed(userId: number): Promise<CommentActionResult | null> {
  if (!(await isPostingSuspended(userId))) return null;
  return {
    ok: false,
    message:
      "Akun Anda sedang dibatasi dari diskusi publik: tidak dapat membagikan, membalas, atau menulis di diskusi. Catatan pribadi tetap bisa ditulis.",
  };
}

// ============================================================
// CATATAN
// ============================================================

export async function addQuestionCommentAction(
  input: AddQuestionCommentInput,
): Promise<CommentActionResult> {
  const validated = AddQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { target, commentText, commentImages, visibility } = validated.data;
  if (!notesEnabled(target)) notFound();
  if (visibility === "PUBLIC" && !discussionEnabled(target)) notFound();
  // Komentar postingan selalu publik: tidak ada catatan pribadi pada postingan.
  if (target.type === "post" && visibility !== "PUBLIC") notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  requireOwnedCommentImages(commentImages, authSession.userId);
  await ensureTargetExists(target, authSession.userId);

  if (visibility === "PUBLIC") {
    const suspended = await checkPublicPostingAllowed(authSession.userId);
    if (suspended) return suspended;
  }

  const limited = await checkWriteLimit(authSession.userId);
  if (limited) return limited;

  await prisma.questionComment.create({
    data: {
      ...targetColumns(target),
      userId: authSession.userId,
      commentText,
      commentImages,
      visibility,
      sharedAt: visibility === "PUBLIC" ? new Date() : null,
    },
  });
  return { ok: true };
}

export async function updateQuestionCommentAction(
  input: EditQuestionCommentInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = EditQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, commentText, commentImages } = validated.data;
  requireOwnedCommentImages(commentImages, authSession.userId);
  const comment = await requireOwnLiveComment(commentId, authSession.userId);
  if (!notesEnabled(comment.target)) notFound();
  // Menulis di thread postingan yang sudah tidak terlihat (akun private yang
  // tidak lagi diikuti) atau sudah dihapus tidak diizinkan; menghapus tetap bisa.
  await requirePostAccess(comment.target, authSession.userId);

  // Menyunting entri yang sedang tampil publik sama dengan menulis ke diskusi.
  // Balasan selalu publik; root privat (termasuk yang disembunyikan) bebas.
  if (comment.parentId !== null || comment.visibility === "PUBLIC") {
    const suspended = await checkPublicPostingAllowed(authSession.userId);
    if (suspended) return suspended;
  }

  const limited = await checkWriteLimit(authSession.userId);
  if (limited) return limited;

  await prisma.questionComment.update({
    where: { id: commentId },
    data: { commentText, commentImages },
  });
  return { ok: true };
}

// Selalu soft delete, tidak pernah menghapus baris. Balasan user lain menempel
// pada root ini; menghapusnya secara fisik akan ikut memusnahkan percakapan
// mereka. Baris yang tertinggal juga menjadi bahan moderasi admin. Tidak dibatasi
// rate limit: menarik tulisan sendiri tidak boleh terhalang kuota.
export async function deleteQuestionCommentAction(
  input: DeleteQuestionCommentInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = DeleteQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId } = validated.data;
  const comment = await requireOwnLiveComment(commentId, authSession.userId);
  if (!notesEnabled(comment.target)) notFound();

  await prisma.questionComment.update({
    where: { id: commentId },
    // deletedById dicatat supaya moderasi dapat membedakan hapusan pemilik dari
    // takedown admin. Hanya takedown admin yang boleh dipulihkan.
    data: { deletedAt: new Date(), deletedById: authSession.userId },
  });
  return { ok: true };
}

/** Catatan user pada satu kata; dipakai reviewer setelah catatannya berubah. */
export async function getOwnVocabNotesAction(input: GetOwnVocabNotesInput): Promise<OwnNote[]> {
  if (!FEATURES.flashcardDiscussion) notFound();

  const authSession = await getSession();
  if (!authSession) return [];

  const validated = GetOwnVocabNotesSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const notes = await getOwnVocabNotes(authSession.userId, [validated.data.vocabId]);
  return notes.get(validated.data.vocabId) ?? [];
}

// ============================================================
// DISKUSI PUBLIK
// ============================================================

export async function setQuestionCommentVisibilityAction(
  input: SetQuestionCommentVisibilityInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = SetQuestionCommentVisibilitySchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { commentId, visibility } = validated.data;
  const comment = await requireOwnLiveComment(commentId, authSession.userId);
  if (!discussionEnabled(comment.target)) notFound();
  // Komentar postingan tidak punya versi privat.
  if (comment.target.type === "post") notFound();

  // Balasan mewarisi visibility root-nya dan tidak punya toggle sendiri.
  if (comment.parentId) notFound();

  // Hanya membagikan yang dibatasi: menarik kembali ke privat harus selalu bisa.
  if (visibility === "PUBLIC") {
    const suspended = await checkPublicPostingAllowed(authSession.userId);
    if (suspended) return suspended;

    const limited = await checkWriteLimit(authSession.userId);
    if (limited) return limited;
  }

  await prisma.questionComment.update({
    where: { id: commentId },
    data: {
      visibility,
      // `sharedAt` mencatat kapan catatan ini pertama kali masuk thread publik
      // dan tidak pernah dikosongkan lagi, supaya root yang dikembalikan ke
      // privat tetap tampil sebagai tombstone di atas balasan yang sudah ada.
      ...(visibility === "PUBLIC" && !comment.sharedAt ? { sharedAt: new Date() } : {}),
    },
  });
  return { ok: true };
}

export async function replyToQuestionCommentAction(
  input: ReplyQuestionCommentInput,
): Promise<CommentActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = ReplyQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }

  const { parentId, repliedToId, commentText, commentImages } = validated.data;
  requireOwnedCommentImages(commentImages, authSession.userId);

  const parent = await prisma.questionComment.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) notFound();

  // Balasan hanya satu tingkat: membalas sebuah balasan berarti menambah
  // balasan baru pada root yang sama, bukan membuat cabang baru.
  const rootId = parent.parentId ?? parent.id;

  const root = await prisma.questionComment.findUnique({
    where: { id: rootId },
    select: {
      id: true,
      visibility: true,
      deletedAt: true,
      sharedAt: true,
      ...commentTargetSelect,
    },
  });

  // Thread yang sudah disembunyikan atau dihapus menjadi arsip read-only.
  if (!root || root.deletedAt || root.visibility !== "PUBLIC" || !root.sharedAt) {
    notFound();
  }
  const target = targetOf(root);
  if (!target || !discussionEnabled(target)) notFound();
  await requirePostAccess(target, authSession.userId);

  // Mention hanya diterima bila menunjuk comment hidup di thread yang sama.
  // Tanpa cek ini, balasan bisa "membalas" comment di soal lain dan merender
  // username orang yang tidak pernah ikut percakapan ini.
  let mentionId: number | null = null;
  if (repliedToId !== null) {
    const mentionTarget = await prisma.questionComment.findUnique({
      where: { id: repliedToId },
      select: { id: true, parentId: true, deletedAt: true },
    });
    const mentionRootId = mentionTarget?.parentId ?? mentionTarget?.id;
    if (mentionTarget && !mentionTarget.deletedAt && mentionRootId === root.id) {
      mentionId = mentionTarget.id;
    }
  }

  const suspended = await checkPublicPostingAllowed(authSession.userId);
  if (suspended) return suspended;

  const limited = await checkWriteLimit(authSession.userId);
  if (limited) return limited;

  await prisma.questionComment.create({
    data: {
      // Balasan mewarisi target root, sehingga thread tidak pernah bercampur.
      questionId: root.questionId,
      vocabId: root.vocabId,
      bunpouPointId: root.bunpouPointId,
      postId: root.postId,
      userId: authSession.userId,
      parentId: root.id,
      repliedToId: mentionId,
      commentText,
      commentImages,
      // Balasan ikut visibility root; tidak pernah menjadi catatan pribadi.
      visibility: "PUBLIC",
      sharedAt: new Date(),
    },
  });
  return { ok: true };
}

export async function getDiscussionAction(
  input: GetDiscussionInput,
): Promise<DiscussionThreadData> {
  const validated = GetDiscussionSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }
  if (!discussionEnabled(validated.data.target)) notFound();

  // Diskusi publik terbuka untuk guest; login hanya dibutuhkan untuk menulis.
  const authSession = await getSession();
  const viewerId = authSession?.userId ?? null;
  await requirePostAccess(validated.data.target, viewerId, { allowDeleted: true });
  const [roots, postingSuspended] = await Promise.all([
    getDiscussion(validated.data.target),
    isPostingSuspended(viewerId),
  ]);
  return { roots: await withViewerVotes(roots, viewerId), postingSuspended };
}

// ============================================================
// SUARA "MEMBANTU"
// ============================================================

export type VoteActionResult =
  | { ok: true; voted: boolean; voteCount: number }
  | { ok: false; message: string };

/**
 * Memberi atau menarik suara "membantu". Satu suara per user per entri
 * (PK `commentId + userId`), tanpa downvote. Kuota Redis sendiri, terpisah dari
 * kuota tulis. User yang di-suspend dari posting tetap boleh memberi suara:
 * suara tidak menerbitkan konten apa pun.
 *
 * Menarik suara tidak memeriksa keadaan entri — takedown tidak menghapus suara,
 * dan pemiliknya tetap boleh menariknya.
 */
export async function voteQuestionCommentAction(
  input: VoteQuestionCommentInput,
): Promise<VoteActionResult> {
  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = VoteQuestionCommentSchema.safeParse(input);
  if (!validated.success) {
    throw new Error("Data tidak valid.");
  }
  const { commentId, voted } = validated.data;
  const userId = authSession.userId;

  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      deletedAt: true,
      visibility: true,
      sharedAt: true,
      ...commentTargetSelect,
      parent: { select: { visibility: true, sharedAt: true, deletedAt: true } },
    },
  });
  if (!comment) notFound();
  const target = targetOf(comment);
  if (!target || !discussionEnabled(target)) notFound();

  if (voted) {
    // Thread postingan yang dihapus adalah arsip read-only, sama seperti root
    // tombstone; postingan akun private hanya untuk yang boleh melihatnya.
    await requirePostAccess(target, userId);
    const rejection = voteRejection(
      { authorId: comment.userId, deletedAt: comment.deletedAt, root: comment.parent ?? comment },
      userId,
    );
    if (rejection === "unavailable") notFound();
    if (rejection === "own") {
      return { ok: false, message: "Tidak bisa memberi suara pada catatan sendiri." };
    }
  }

  const limit = await limitByRedis("comment-vote", userId, COMMENT_VOTE_RATE_LIMITS);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Terlalu banyak suara dalam waktu singkat. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }

  if (voted) {
    // skipDuplicates: klik ganda atau retry tidak menggagalkan apa pun.
    await prisma.questionCommentVote.createMany({
      data: [{ commentId, userId }],
      skipDuplicates: true,
    });
  } else {
    await prisma.questionCommentVote.deleteMany({ where: { commentId, userId } });
  }

  const counts = await countVotes([commentId]);
  return { ok: true, voted, voteCount: counts.get(commentId) ?? 0 };
}

// ============================================================
// UPLOAD GAMBAR
// ============================================================

export type CommentImageUploadResult =
  | { ok: true; uploadUrl: string; url: string; contentType: string }
  | { ok: false; message: string };

// Browser meng-PUT langsung ke R2 dengan presigned URL ini; server tidak pernah
// memproksikan file dan R2_SECRET_ACCESS_KEY tidak pernah sampai ke client.
// Content-type dan ukuran ikut ditandatangani, jadi R2 sendiri yang menolak
// upload di luar batas.
export async function createCommentImageUploadAction(
  input: CreateCommentImageUploadInput,
): Promise<CommentImageUploadResult> {
  // Postingan memakai uploader dan prefix object yang sama dengan komentar.
  if (!FEATURES.questionComment && !FEATURES.flashcardDiscussion && !FEATURES.community) notFound();

  const authSession = await getSession();
  if (!authSession) redirect("/login");

  const validated = CreateCommentImageUploadSchema.safeParse(input);
  if (!validated.success) {
    return {
      ok: false,
      message: validated.error.issues[0]?.message ?? "Permintaan upload tidak valid.",
    };
  }

  const limit = await limitByRedis(
    "comment-image-upload",
    authSession.userId,
    COMMENT_IMAGE_UPLOAD_RATE_LIMITS,
  );
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Terlalu banyak gambar diunggah. Coba lagi dalam ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    };
  }

  const upload = await createCommentImageUpload({
    userId: authSession.userId,
    contentType: validated.data.contentType,
    byteLength: validated.data.byteLength,
  });
  return { ok: true, ...upload };
}
