import "server-only";

import type { JlptLevel, MondaiType, Prisma } from "@prisma/client";
import { z } from "zod";
import { FEATURES } from "@/constants";
import { profilePath } from "@/features/public-profile/access";
import { prisma } from "@/lib/prisma";
import { QUESTION_EXPLANATION_SELECT } from "@/lib/question-explanation";
import { targetWhere, type CommentTarget } from "./target";

// ============================================================
// BENTUK DATA YANG DIKIRIM KE CLIENT
// ============================================================

export type DiscussionAuthor = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** `/u/<username>`, atau null bila profil publik mati. Dihitung di server. */
  profilePath: string | null;
};

// Tujuan sebuah balasan. Disimpan sebagai relasi lalu di-resolve saat baca,
// bukan teks "@nama" di dalam isi komentar — ganti username otomatis ikut
// terbawa, dan mention tidak bisa dipalsukan.
export type DiscussionMention = {
  id: number;
  username: string;
} | null;

// Suara "membantu". Yang dikirim ke client hanya jumlahnya dan apakah viewer
// yang sedang login ikut memberi suara — tidak pernah siapa saja pemberinya,
// karena thread dirender server dan diindeks.
export type DiscussionVotes = {
  voteCount: number;
  /** Selalu false untuk guest dan sebelum `withViewerVotes`. */
  viewerVoted: boolean;
};

export type DiscussionReply = DiscussionVotes & {
  id: number;
  commentText: string;
  commentImages: string[];
  createdAt: Date;
  updatedAt: Date;
  author: DiscussionAuthor;
  repliedTo: DiscussionMention;
};

// VISIBLE  : catatan publik yang masih hidup, isi ditampilkan utuh.
// HIDDEN   : pemilik mengembalikannya ke privat, balasan orang lain tetap ada.
// DELETED  : pemilik menghapusnya, balasan orang lain tetap ada.
export type DiscussionRootState = "VISIBLE" | "HIDDEN" | "DELETED";

export type DiscussionRoot = DiscussionVotes & {
  id: number;
  // Tepat satu terisi: soal JLPT, kata flashcard, pola bunpou, atau postingan.
  questionId: number | null;
  vocabId: number | null;
  bunpouPointId: number | null;
  postId: number | null;
  state: DiscussionRootState;
  createdAt: Date;
  // Empat field di bawah — dan suaranya — hanya terisi saat state === "VISIBLE".
  // Untuk tombstone isinya sengaja tidak ikut diambil dari baris database supaya
  // teks/gambar yang sudah dihapus atau disembunyikan tidak pernah sampai ke
  // browser.
  commentText: string | null;
  commentImages: string[];
  updatedAt: Date | null;
  author: DiscussionAuthor | null;
  replies: DiscussionReply[];
};

const discussionAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

const discussionRootSelect = {
  id: true,
  questionId: true,
  vocabId: true,
  bunpouPointId: true,
  postId: true,
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
      repliedTo: {
        select: { id: true, deletedAt: true, user: { select: { username: true } } },
      },
    },
  },
} satisfies Prisma.QuestionCommentSelect;

type RawDiscussionRoot = Prisma.QuestionCommentGetPayload<{
  select: typeof discussionRootSelect;
}>;

function toDiscussionAuthor(
  user: Prisma.UserGetPayload<{ select: typeof discussionAuthorSelect }>,
): DiscussionAuthor {
  return { ...user, profilePath: profilePath(user.username, FEATURES.publicProfile) };
}

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
    // Mention ke komentar yang sudah dihapus tidak dirender: nama penulisnya
    // adalah bagian dari isi yang sudah ditarik.
    repliedTo:
      reply.repliedTo && !reply.repliedTo.deletedAt
        ? { id: reply.repliedTo.id, username: reply.repliedTo.user.username }
        : null,
    commentText: reply.commentText,
    commentImages: reply.commentImages,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
    author: toDiscussionAuthor(reply.user),
    voteCount: 0,
    viewerVoted: false,
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
      vocabId: row.vocabId,
      bunpouPointId: row.bunpouPointId,
      postId: row.postId,
      state,
      createdAt: row.createdAt,
      commentText: null,
      commentImages: [],
      updatedAt: null,
      author: null,
      voteCount: 0,
      viewerVoted: false,
      replies,
    };
  }

  return {
    id: row.id,
    questionId: row.questionId,
    vocabId: row.vocabId,
    bunpouPointId: row.bunpouPointId,
    postId: row.postId,
    state,
    createdAt: row.createdAt,
    commentText: row.commentText,
    commentImages: row.commentImages,
    updatedAt: row.updatedAt,
    author: toDiscussionAuthor(row.user),
    voteCount: 0,
    viewerVoted: false,
    replies,
  };
}

// ============================================================
// SUARA "MEMBANTU"
// ============================================================

/** Id entri yang boleh membawa suara: root VISIBLE dan seluruh balasan yang tampil. */
function votableIds(roots: DiscussionRoot[]) {
  return roots.flatMap((root) => [
    ...(root.state === "VISIBLE" ? [root.id] : []),
    ...root.replies.map((reply) => reply.id),
  ]);
}

function mapEntries(
  roots: DiscussionRoot[],
  apply: <T extends DiscussionVotes & { id: number }>(entry: T) => T,
): DiscussionRoot[] {
  return roots.map((root) => ({
    ...(root.state === "VISIBLE" ? apply(root) : root),
    replies: root.replies.map(apply),
  }));
}

/** Jumlah suara per entri, satu `groupBy` untuk seluruh thread. */
export async function countVotes(commentIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (commentIds.length === 0) return counts;
  const grouped = await prisma.questionCommentVote.groupBy({
    by: ["commentId"],
    where: { commentId: { in: commentIds } },
    _count: { _all: true },
  });
  for (const row of grouped) counts.set(row.commentId, row._count._all);
  return counts;
}

// Tombstone tidak membawa jumlah suara: sama seperti isinya, angka itu bagian
// dari entri yang sudah ditarik.
async function withVoteCounts(roots: DiscussionRoot[]): Promise<DiscussionRoot[]> {
  const counts = await countVotes(votableIds(roots));
  if (counts.size === 0) return roots;
  return mapEntries(roots, (entry) => ({ ...entry, voteCount: counts.get(entry.id) ?? 0 }));
}

/**
 * Menandai entri yang sudah diberi suara oleh viewer. Dipisah dari
 * `getDiscussion` supaya thread itu sendiri tetap sama untuk semua orang
 * (metadata halaman memakai hasil yang sama lewat `cache`).
 */
export async function withViewerVotes(
  roots: DiscussionRoot[],
  viewerId: number | null,
): Promise<DiscussionRoot[]> {
  if (viewerId === null) return roots;
  const ids = votableIds(roots);
  if (ids.length === 0) return roots;
  const votes = await prisma.questionCommentVote.findMany({
    where: { userId: viewerId, commentId: { in: ids } },
    select: { commentId: true },
  });
  if (votes.length === 0) return roots;
  const voted = new Set(votes.map((vote) => vote.commentId));
  return mapEntries(roots, (entry) => ({ ...entry, viewerVoted: voted.has(entry.id) }));
}

// Tombstone tanpa balasan tidak berguna untuk siapa pun: yang tersisa hanya
// keterangan "dihapus" tanpa percakapan. Root seperti itu dibuang sepenuhnya.
function isWorthRendering(root: DiscussionRoot) {
  return root.state === "VISIBLE" || root.replies.length > 0;
}

// ============================================================
// THREAD PER TARGET (SOAL ATAU KATA)
// ============================================================

export async function getDiscussion(target: CommentTarget): Promise<DiscussionRoot[]> {
  const rows = await prisma.questionComment.findMany({
    where: { ...targetWhere(target), ...publicRootWhere },
    orderBy: { createdAt: "desc" },
    select: discussionRootSelect,
  });

  return withVoteCounts(rows.map(toDiscussionRoot).filter(isWorthRendering));
}

// Yang dihitung adalah entri yang benar-benar tampil: root publik yang masih
// hidup, ditambah seluruh balasan hidup — termasuk balasan pada root yang
// sudah disembunyikan atau dihapus, karena balasan itu tetap dirender.
const countedEntryWhere = {
  deletedAt: null,
  OR: [{ parentId: { not: null } }, { visibility: "PUBLIC" as const, ...publicRootWhere }],
} satisfies Prisma.QuestionCommentWhereInput;

// Dipakai halaman mode baca dan result detail hanya untuk label tombol
// "Diskusi (n)". Thread-nya sendiri baru diambil saat tombol diklik, supaya
// payload halaman tidak membengkak oleh percakapan yang belum tentu dibuka.
export async function getQuestionDiscussionCounts(
  questionIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (questionIds.length === 0) return counts;

  const grouped = await prisma.questionComment.groupBy({
    by: ["questionId"],
    where: { questionId: { in: questionIds }, ...countedEntryWhere },
    _count: { _all: true },
  });

  for (const row of grouped) {
    if (row.questionId !== null) counts.set(row.questionId, row._count._all);
  }

  return counts;
}

/** Padanan `getQuestionDiscussionCounts` untuk postingan komunitas (label komentar di feed). */
export async function getPostCommentCounts(postIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (postIds.length === 0) return counts;

  const grouped = await prisma.questionComment.groupBy({
    by: ["postId"],
    where: { postId: { in: postIds }, ...countedEntryWhere },
    _count: { _all: true },
  });

  for (const row of grouped) {
    if (row.postId !== null) counts.set(row.postId, row._count._all);
  }

  return counts;
}

/** Padanan `getQuestionDiscussionCounts` untuk kata flashcard (sesi belajar, daftar kata). */
export async function getVocabDiscussionCounts(vocabIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (vocabIds.length === 0) return counts;

  const grouped = await prisma.questionComment.groupBy({
    by: ["vocabId"],
    where: { vocabId: { in: vocabIds }, ...countedEntryWhere },
    _count: { _all: true },
  });

  for (const row of grouped) {
    if (row.vocabId !== null) counts.set(row.vocabId, row._count._all);
  }

  return counts;
}

// ============================================================
// SUSPEND POSTING
// ============================================================

/**
 * Rem darurat moderasi (`User.postingSuspendedAt`, diatur admin). User yang
 * di-suspend tidak dapat menulis ke diskusi publik; catatan privat tetap boleh.
 * Guest selalu `false` — mereka memang belum bisa menulis.
 *
 * Dibaca per request dan tidak di-cache, sama seperti role: suspend harus
 * berlaku seketika tanpa user login ulang.
 */
export async function isPostingSuspended(userId: number | null): Promise<boolean> {
  if (userId === null) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { postingSuspendedAt: true },
  });
  return Boolean(user?.postingSuspendedAt);
}

// ============================================================
// CATATAN PRIBADI MILIK USER
// ============================================================

export const ownNoteSelect = {
  id: true,
  questionId: true,
  vocabId: true,
  bunpouPointId: true,
  commentText: true,
  commentImages: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { displayName: true } },
} satisfies Prisma.QuestionCommentSelect;

export type OwnNote = Prisma.QuestionCommentGetPayload<{ select: typeof ownNoteSelect }>;

/**
 * Catatan milik user pada sekumpulan kata, termasuk yang sudah dibagikan.
 * Balasan (`parentId != null`) hidup di dalam thread publik, jadi tidak ikut —
 * ini panel "Catatanku", bukan thread.
 */
export async function getOwnVocabNotes(
  userId: number,
  vocabIds: number[],
): Promise<Map<number, OwnNote[]>> {
  const notes = new Map<number, OwnNote[]>();
  if (vocabIds.length === 0) return notes;

  const rows = await prisma.questionComment.findMany({
    where: { userId, vocabId: { in: vocabIds }, parentId: null, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: ownNoteSelect,
  });

  for (const row of rows) {
    if (row.vocabId === null) continue;
    const list = notes.get(row.vocabId) ?? [];
    list.push(row);
    notes.set(row.vocabId, list);
  }

  return notes;
}

/** Catatan milik user pada satu pola bunpou, termasuk yang sudah dibagikan. */
export async function getOwnBunpouNotes(userId: number, bunpouPointId: number): Promise<OwnNote[]> {
  return prisma.questionComment.findMany({
    where: { userId, bunpouPointId, parentId: null, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: ownNoteSelect,
  });
}

/** Jumlah entri yang benar-benar tampil di thread, sama dengan definisi `countedEntryWhere`. */
export function countDiscussionEntries(roots: DiscussionRoot[]) {
  return roots.reduce(
    (total, root) => total + root.replies.length + (root.state === "VISIBLE" ? 1 : 0),
    0,
  );
}

// ============================================================
// PERMALINK
// ============================================================

export type DiscussionQuestion = Prisma.QuestionGetPayload<{
  select: typeof permalinkQuestionSelect;
}>;

export type DiscussionPermalink = {
  root: DiscussionRoot;
  question: DiscussionQuestion;
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
    select: {
      id: true,
      parentId: true,
      sharedAt: true,
      questionId: true,
      vocabId: true,
      bunpouPointId: true,
      postId: true,
    },
  });

  if (!comment) return null;
  const target = {
    questionId: comment.questionId,
    vocabId: comment.vocabId,
    bunpouPointId: comment.bunpouPointId,
    postId: comment.postId,
  };
  if (comment.parentId) return { rootId: comment.parentId, isReply: true as const, ...target };
  if (!comment.sharedAt) return null; // catatan pribadi tidak punya permalink
  return { rootId: comment.id, isReply: false as const, ...target };
}

export async function getDiscussionPermalink(
  rootId: number,
): Promise<DiscussionPermalink | null> {
  // Permalink ini khusus thread soal; thread kata dibaca di halaman katanya.
  const row = await prisma.questionComment.findFirst({
    where: { id: rootId, questionId: { not: null }, ...publicRootWhere },
    select: { ...discussionRootSelect, question: { select: permalinkQuestionSelect } },
  });

  if (!row?.question) return null;

  const root = toDiscussionRoot(row);
  if (!isWorthRendering(root)) return null;

  const [withCounts] = await withVoteCounts([root]);
  return { root: withCounts!, question: row.question };
}

// ============================================================
// HALAMAN DISKUSI PER SOAL
// ============================================================

export type QuestionDiscussionPage = {
  question: DiscussionQuestion;
  roots: DiscussionRoot[];
};

export async function getQuestionDiscussionPage(
  questionId: number,
): Promise<QuestionDiscussionPage | null> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: permalinkQuestionSelect,
  });
  if (!question) return null;

  return { question, roots: await getDiscussion({ type: "question", questionId }) };
}

// ============================================================
// INDEKS SELURUH DISKUSI
// ============================================================

export type DiscussionIndexEntry = {
  questionId: number;
  questionOrder: number;
  questionText: string | null;
  entryCount: number;
  lastActivityAt: Date;
  testPackage: { id: number; name: string; jlptLevel: JlptLevel };
  testPackageItem: { id: number; mondaiType: MondaiType };
};

export const DISCUSSION_INDEX_PAGE_SIZE = 20;

// Entri yang benar-benar tampil di thread: root publik yang masih hidup plus
// seluruh balasan hidup. Definisi yang sama dipakai `getQuestionDiscussionCounts`.
const visibleDiscussionEntryWhere = countedEntryWhere;

export async function getDiscussionIndex(page: number): Promise<{
  entries: DiscussionIndexEntry[];
  hasMore: boolean;
}> {
  const skip = Math.max(0, page - 1) * DISCUSSION_INDEX_PAGE_SIZE;

  // Satu baris per soal, diurutkan dari aktivitas terbaru. Mengambil satu baris
  // lebih banyak dari ukuran halaman supaya `hasMore` tidak butuh COUNT DISTINCT
  // terpisah.
  const grouped = await prisma.questionComment.groupBy({
    by: ["questionId"],
    where: { questionId: { not: null }, ...visibleDiscussionEntryWhere },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: DISCUSSION_INDEX_PAGE_SIZE + 1,
    skip,
  });

  const hasMore = grouped.length > DISCUSSION_INDEX_PAGE_SIZE;
  const rows = hasMore ? grouped.slice(0, DISCUSSION_INDEX_PAGE_SIZE) : grouped;
  if (rows.length === 0) return { entries: [], hasMore: false };

  const questionIds = rows.flatMap((row) => (row.questionId === null ? [] : [row.questionId]));
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      order: true,
      questionText: true,
      testPackageItem: {
        select: {
          id: true,
          mondaiType: true,
          testPackage: { select: { id: true, name: true, jlptLevel: true } },
        },
      },
    },
  });
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const entries: DiscussionIndexEntry[] = [];
  for (const row of rows) {
    if (row.questionId === null) continue;
    const question = questionById.get(row.questionId);
    if (!question || !row._max.createdAt) continue;

    entries.push({
      questionId: question.id,
      questionOrder: question.order,
      questionText: question.questionText,
      entryCount: row._count._all,
      lastActivityAt: row._max.createdAt,
      testPackage: question.testPackageItem.testPackage,
      testPackageItem: {
        id: question.testPackageItem.id,
        mondaiType: question.testPackageItem.mondaiType,
      },
    });
  }

  return { entries, hasMore };
}

// ============================================================
// INDEKS DISKUSI KATA FLASHCARD
// ============================================================

export type VocabDiscussionIndexEntry = {
  vocabId: number;
  level: JlptLevel;
  wordPlain: string;
  reading: string;
  meaningsId: string[];
  entryCount: number;
  lastActivityAt: Date;
};

/** Padanan `getDiscussionIndex` untuk kata flashcard: satu baris per kata. */
export async function getVocabDiscussionIndex(page: number): Promise<{
  entries: VocabDiscussionIndexEntry[];
  hasMore: boolean;
}> {
  const skip = Math.max(0, page - 1) * DISCUSSION_INDEX_PAGE_SIZE;

  const grouped = await prisma.questionComment.groupBy({
    by: ["vocabId"],
    where: { vocabId: { not: null }, ...visibleDiscussionEntryWhere },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: DISCUSSION_INDEX_PAGE_SIZE + 1,
    skip,
  });

  const hasMore = grouped.length > DISCUSSION_INDEX_PAGE_SIZE;
  const rows = hasMore ? grouped.slice(0, DISCUSSION_INDEX_PAGE_SIZE) : grouped;
  const vocabIds = rows.flatMap((row) => (row.vocabId === null ? [] : [row.vocabId]));
  if (vocabIds.length === 0) return { entries: [], hasMore: false };

  const words = await prisma.flashcardVocab.findMany({
    where: { id: { in: vocabIds } },
    select: { id: true, level: true, wordPlain: true, reading: true, meaningsId: true },
  });
  const wordById = new Map(words.map((word) => [word.id, word]));

  const entries: VocabDiscussionIndexEntry[] = [];
  for (const row of rows) {
    const word = row.vocabId === null ? undefined : wordById.get(row.vocabId);
    if (!word || !row._max.createdAt) continue;
    entries.push({
      vocabId: word.id,
      level: word.level,
      wordPlain: word.wordPlain,
      reading: word.reading,
      meaningsId: word.meaningsId,
      entryCount: row._count._all,
      lastActivityAt: row._max.createdAt,
    });
  }

  return { entries, hasMore };
}

// ============================================================
// INDEKS DISKUSI POLA BUNPOU
// ============================================================

export type BunpouDiscussionIndexEntry = {
  key: string;
  level: JlptLevel;
  title: string;
  senseLabel: string | null;
  meaningId: string;
  entryCount: number;
  lastActivityAt: Date;
};

// `content` pola divalidasi ketat oleh seed; di sini cukup label maknanya.
const SenseLabelSchema = z
  .object({ senseLabel: z.string().nullable().catch(null) })
  .catch({ senseLabel: null });

/** Padanan `getDiscussionIndex` untuk pola bunpou: satu baris per pola. */
export async function getBunpouDiscussionIndex(page: number): Promise<{
  entries: BunpouDiscussionIndexEntry[];
  hasMore: boolean;
}> {
  const skip = Math.max(0, page - 1) * DISCUSSION_INDEX_PAGE_SIZE;

  const grouped = await prisma.questionComment.groupBy({
    by: ["bunpouPointId"],
    where: { bunpouPointId: { not: null }, ...visibleDiscussionEntryWhere },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: DISCUSSION_INDEX_PAGE_SIZE + 1,
    skip,
  });

  const hasMore = grouped.length > DISCUSSION_INDEX_PAGE_SIZE;
  const rows = hasMore ? grouped.slice(0, DISCUSSION_INDEX_PAGE_SIZE) : grouped;
  const pointIds = rows.flatMap((row) => (row.bunpouPointId === null ? [] : [row.bunpouPointId]));
  if (pointIds.length === 0) return { entries: [], hasMore: false };

  // Pola yang sudah dipensiunkan 404 di /bunpou, jadi tidak ditautkan dari sini.
  const points = await prisma.bunpouPoint.findMany({
    where: { id: { in: pointIds }, retiredAt: null },
    select: {
      id: true,
      key: true,
      level: true,
      title: true,
      meaningId: true,
      content: true,
    },
  });
  const pointById = new Map(points.map((point) => [point.id, point]));

  const entries: BunpouDiscussionIndexEntry[] = [];
  for (const row of rows) {
    const point = row.bunpouPointId === null ? undefined : pointById.get(row.bunpouPointId);
    if (!point || !row._max.createdAt) continue;
    entries.push({
      key: point.key,
      level: point.level,
      title: point.title,
      senseLabel: SenseLabelSchema.parse(point.content).senseLabel,
      meaningId: point.meaningId,
      entryCount: row._count._all,
      lastActivityAt: row._max.createdAt,
    });
  }

  return { entries, hasMore };
}

// ============================================================
// SITEMAP
// ============================================================

/**
 * Soal dan kata yang punya minimal satu entri diskusi tampil, beserta waktu
 * aktivitas terakhirnya. Hanya halaman diskusi inilah yang layak diindeks;
 * halaman diskusi kosong diberi `noindex`. Diskusi pola tidak perlu ikut: pola
 * sudah masuk sitemap sebagai halaman katalog.
 */
export async function getDiscussionSitemapTargets() {
  const [questions, vocabs] = await Promise.all([
    prisma.questionComment.groupBy({
      by: ["questionId"],
      where: { questionId: { not: null }, ...visibleDiscussionEntryWhere },
      _max: { createdAt: true },
    }),
    prisma.questionComment.groupBy({
      by: ["vocabId"],
      where: { vocabId: { not: null }, ...visibleDiscussionEntryWhere },
      _max: { createdAt: true },
    }),
  ]);

  return {
    questions: questions.flatMap((row) =>
      row.questionId !== null && row._max.createdAt
        ? [{ id: row.questionId, lastActivityAt: row._max.createdAt }]
        : [],
    ),
    vocabs: vocabs.flatMap((row) =>
      row.vocabId !== null && row._max.createdAt
        ? [{ id: row.vocabId, lastActivityAt: row._max.createdAt }]
        : [],
    ),
  };
}
