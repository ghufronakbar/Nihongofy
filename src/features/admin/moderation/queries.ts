import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ModerationQueryInput } from "./schemas";

// Tidak di-cache, sejalan dengan modul diskusi itu sendiri: thread dan
// hitungannya memang tidak punya tag di CACHE_TAGS karena isinya berubah setiap
// ada balasan. Antrean moderasi justru harus selalu menampilkan keadaan terkini.

// Berbeda dengan tampilan publik, admin SELALU melihat isi aslinya — termasuk
// entri yang sudah di-takedown. Justru itulah yang perlu ditinjau. Karena itu
// query ini tidak boleh dipakai ulang oleh jalur publik mana pun.
const moderationSelect = {
  id: true,
  questionId: true,
  vocabId: true,
  parentId: true,
  commentText: true,
  commentImages: true,
  visibility: true,
  sharedAt: true,
  deletedAt: true,
  deletedById: true,
  createdAt: true,
  user: { select: { id: true, displayName: true, email: true } },
  deletedBy: { select: { id: true, displayName: true } },
  question: {
    select: {
      id: true,
      order: true,
      testPackageItem: {
        select: {
          mondaiType: true,
          session: true,
          testPackage: { select: { id: true, name: true, jlptLevel: true } },
        },
      },
    },
  },
  // Catatan kata flashcard: tepat satu dari `question`/`vocab` terisi.
  vocab: { select: { id: true, level: true, wordPlain: true, reading: true } },
} satisfies Prisma.QuestionCommentSelect;

type ModerationRow = Prisma.QuestionCommentGetPayload<{ select: typeof moderationSelect }>;

export type ModerationEntryState = "VISIBLE" | "HIDDEN" | "REMOVED_BY_OWNER" | "TAKEN_DOWN";

export type ModerationEntry = Omit<ModerationRow, "deletedById"> & {
  kind: "root" | "reply";
  state: ModerationEntryState;
  // Hanya takedown admin yang dapat dipulihkan. Memulihkan hapusan pemilik
  // berarti menerbitkan ulang tulisan yang sengaja ia tarik.
  canRestore: boolean;
};

function toEntry(row: ModerationRow): ModerationEntry {
  const { deletedById, ...rest } = row;
  const removedByAdmin = Boolean(row.deletedAt) && deletedById !== null && deletedById !== row.user.id;

  const state: ModerationEntryState = row.deletedAt
    ? removedByAdmin
      ? "TAKEN_DOWN"
      : "REMOVED_BY_OWNER"
    : row.visibility === "PUBLIC"
      ? "VISIBLE"
      : "HIDDEN";

  return {
    ...rest,
    kind: row.parentId === null ? "root" : "reply",
    state,
    canRestore: state === "TAKEN_DOWN",
  };
}

export async function listModerationQueue(filter: ModerationQueryInput) {
  // Keanggotaan konten publik ditentukan `sharedAt`, bukan `visibility`: catatan
  // yang pernah dibagikan tetap relevan untuk moderasi meski sudah ditarik
  // kembali menjadi privat. Catatan yang tidak pernah dibagikan tidak pernah
  // terlihat siapa pun selain pemiliknya dan karena itu tidak masuk antrean.
  const where: Prisma.QuestionCommentWhereInput = { sharedAt: { not: null } };

  if (filter.state === "live") where.deletedAt = null;
  if (filter.state === "removed") where.deletedAt = { not: null };
  if (filter.userId) where.userId = filter.userId;
  if (filter.query) {
    where.OR = [
      { commentText: { contains: filter.query, mode: "insensitive" } },
      { user: { displayName: { contains: filter.query, mode: "insensitive" } } },
    ];
  }

  const [rows, totals] = await Promise.all([
    prisma.questionComment.findMany({
      where,
      orderBy: { sharedAt: "desc" },
      take: 100,
      select: moderationSelect,
    }),
    prisma.questionComment.groupBy({
      by: ["deletedAt"],
      where: { sharedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  // groupBy pada kolom nullable mengembalikan satu baris per timestamp berbeda,
  // jadi yang dihitung adalah "punya deletedAt atau tidak", bukan nilainya.
  let live = 0;
  let removed = 0;
  for (const row of totals) {
    if (row.deletedAt === null) live += row._count._all;
    else removed += row._count._all;
  }

  return {
    entries: rows.map(toEntry),
    counts: { all: live + removed, live, removed },
    truncated: rows.length === 100,
  };
}

export async function getModerationUserSummary(userId: number) {
  const [user, roots, replies, removed] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, email: true, createdAt: true, role: true },
    }),
    prisma.questionComment.count({
      where: { userId, parentId: null, sharedAt: { not: null } },
    }),
    prisma.questionComment.count({ where: { userId, parentId: { not: null } } }),
    prisma.questionComment.count({
      where: { userId, deletedAt: { not: null }, deletedById: { not: userId } },
    }),
  ]);

  if (!user) return null;
  return { user, roots, replies, takenDown: removed };
}
