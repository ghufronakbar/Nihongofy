import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { QUESTION_EXPLANATION_SELECT } from "@/lib/question-explanation";

// ============================================================
// BENTUK DATA YANG DIKIRIM KE CLIENT
// ============================================================

export type DiscussionAuthor = {
  id: number;
  displayName: string;
  avatarUrl: string | null;
};

export type DiscussionReply = {
  id: number;
  commentText: string;
  commentImages: string[];
  createdAt: Date;
  updatedAt: Date;
  author: DiscussionAuthor;
};

// VISIBLE  : catatan publik yang masih hidup, isi ditampilkan utuh.
// HIDDEN   : pemilik mengembalikannya ke privat, balasan orang lain tetap ada.
// DELETED  : pemilik menghapusnya, balasan orang lain tetap ada.
export type DiscussionRootState = "VISIBLE" | "HIDDEN" | "DELETED";

export type DiscussionRoot = {
  id: number;
  questionId: number;
  state: DiscussionRootState;
  createdAt: Date;
  // Empat field di bawah hanya terisi saat state === "VISIBLE". Untuk tombstone
  // isinya sengaja tidak ikut diambil dari baris database supaya teks/gambar
  // yang sudah dihapus atau disembunyikan tidak pernah sampai ke browser.
  commentText: string | null;
  commentImages: string[];
  updatedAt: Date | null;
  author: DiscussionAuthor | null;
  replies: DiscussionReply[];
};

const discussionAuthorSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const discussionRootSelect = {
  id: true,
  questionId: true,
  commentText: true,
  commentImages: true,
  visibility: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: discussionAuthorSelect },
  replies: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      commentText: true,
      commentImages: true,
      createdAt: true,
      updatedAt: true,
      user: { select: discussionAuthorSelect },
    },
  },
} satisfies Prisma.QuestionCommentSelect;

type RawDiscussionRoot = Prisma.QuestionCommentGetPayload<{
  select: typeof discussionRootSelect;
}>;

// Keanggotaan thread publik ditentukan oleh `sharedAt`, bukan `visibility`:
// root yang pernah dibagikan tetap menjadi bagian thread (sebagai tombstone)
// meski sudah dikembalikan ke privat.
const publicRootWhere = {
  parentId: null,
  sharedAt: { not: null },
} satisfies Prisma.QuestionCommentWhereInput;

function toDiscussionRoot(row: RawDiscussionRoot): DiscussionRoot {
  const replies: DiscussionReply[] = row.replies.map((reply) => ({
    id: reply.id,
    commentText: reply.commentText,
    commentImages: reply.commentImages,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
    author: reply.user,
  }));

  const state: DiscussionRootState = row.deletedAt
    ? "DELETED"
    : row.visibility === "PUBLIC"
      ? "VISIBLE"
      : "HIDDEN";

  if (state !== "VISIBLE") {
    return {
      id: row.id,
      questionId: row.questionId,
      state,
      createdAt: row.createdAt,
      commentText: null,
      commentImages: [],
      updatedAt: null,
      author: null,
      replies,
    };
  }

  return {
    id: row.id,
    questionId: row.questionId,
    state,
    createdAt: row.createdAt,
    commentText: row.commentText,
    commentImages: row.commentImages,
    updatedAt: row.updatedAt,
    author: row.user,
    replies,
  };
}

// Tombstone tanpa balasan tidak berguna untuk siapa pun: yang tersisa hanya
// keterangan "dihapus" tanpa percakapan. Root seperti itu dibuang sepenuhnya.
function isWorthRendering(root: DiscussionRoot) {
  return root.state === "VISIBLE" || root.replies.length > 0;
}

// ============================================================
// THREAD PER SOAL
// ============================================================

export async function getQuestionDiscussion(questionId: number): Promise<DiscussionRoot[]> {
  const rows = await prisma.questionComment.findMany({
    where: { questionId, ...publicRootWhere },
    orderBy: { createdAt: "desc" },
    select: discussionRootSelect,
  });

  return rows.map(toDiscussionRoot).filter(isWorthRendering);
}

// Dipakai halaman mode baca dan result detail hanya untuk label tombol
// "Diskusi (n)". Thread-nya sendiri baru diambil saat tombol diklik, supaya
// payload halaman tidak membengkak oleh percakapan yang belum tentu dibuka.
export async function getQuestionDiscussionCounts(
  questionIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (questionIds.length === 0) return counts;

  // Yang dihitung adalah entri yang benar-benar tampil: root publik yang masih
  // hidup, ditambah seluruh balasan hidup — termasuk balasan pada root yang
  // sudah disembunyikan atau dihapus, karena balasan itu tetap dirender.
  const grouped = await prisma.questionComment.groupBy({
    by: ["questionId"],
    where: {
      questionId: { in: questionIds },
      deletedAt: null,
      OR: [{ parentId: { not: null } }, { visibility: "PUBLIC", ...publicRootWhere }],
    },
    _count: { _all: true },
  });

  for (const row of grouped) {
    counts.set(row.questionId, row._count._all);
  }

  return counts;
}

// ============================================================
// PERMALINK
// ============================================================

export type DiscussionPermalink = {
  root: DiscussionRoot;
  question: Prisma.QuestionGetPayload<{ select: typeof permalinkQuestionSelect }>;
};

const permalinkQuestionSelect = {
  id: true,
  order: true,
  questionText: true,
  questionImage: true,
  questionAudio: true,
  questionAnswer: true,
  explanation: { select: QUESTION_EXPLANATION_SELECT },
  questionChoices: {
    orderBy: { codeAnswer: "asc" },
    select: { id: true, codeAnswer: true, answerText: true, answerImage: true },
  },
  questionContext: {
    select: { id: true, storyText: true, storyImage: true, storyAudio: true },
  },
  testPackageItem: {
    select: {
      id: true,
      mondaiType: true,
      session: true,
      instruction: true,
      testPackage: { select: { id: true, name: true, jlptLevel: true } },
    },
  },
} satisfies Prisma.QuestionSelect;

// Mengembalikan id root bila `commentId` ternyata sebuah balasan, supaya caller
// dapat mengarahkan ulang ke permalink root dengan anchor ke balasan tersebut.
export async function resolveDiscussionRootId(commentId: number) {
  const comment = await prisma.questionComment.findUnique({
    where: { id: commentId },
    select: { id: true, parentId: true, sharedAt: true },
  });

  if (!comment) return null;
  if (comment.parentId) return { rootId: comment.parentId, isReply: true as const };
  if (!comment.sharedAt) return null; // catatan pribadi tidak punya permalink
  return { rootId: comment.id, isReply: false as const };
}

export async function getDiscussionPermalink(
  rootId: number,
): Promise<DiscussionPermalink | null> {
  const row = await prisma.questionComment.findFirst({
    where: { id: rootId, ...publicRootWhere },
    select: { ...discussionRootSelect, question: { select: permalinkQuestionSelect } },
  });

  if (!row) return null;

  const root = toDiscussionRoot(row);
  if (!isWorthRendering(root)) return null;

  return { root, question: row.question };
}
