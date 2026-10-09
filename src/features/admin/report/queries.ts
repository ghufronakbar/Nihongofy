import "server-only";

import type { Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toCardContent, VOCAB_CONTENT_SELECT } from "@/features/flashcard/data";
import type { VocabCardContent } from "@/features/flashcard/types";
import type { ReportQueryInput } from "./schemas";

// Tidak di-cache, sama seperti antrean moderasi: layar ini dibuka justru untuk
// melihat keadaan sekarang, termasuk tepat setelah satu laporan ditandai selesai.

const QUEUE_PAGE_SIZE = 20;

const OPEN_STATUSES: ReportStatus[] = ["OPEN", "IN_REVIEW"];
const DONE_STATUSES: ReportStatus[] = ["RESOLVED", "REJECTED", "DUPLICATE"];

const reportSelect = {
  id: true,
  targetType: true,
  category: true,
  status: true,
  targetLabel: true,
  message: true,
  pagePath: true,
  userAgent: true,
  replyEmail: true,
  repliedAt: true,
  replyMessage: true,
  handledAt: true,
  adminNote: true,
  createdAt: true,
  questionId: true,
  articleId: true,
  commentId: true,
  vocabId: true,
  bunpouPointId: true,
  bunpouComparisonId: true,
  postId: true,
  reporter: { select: { id: true, displayName: true, username: true } },
  handledBy: { select: { id: true, displayName: true } },
  repliedBy: { select: { id: true, displayName: true } },
  article: { select: { id: true, slug: true } },
  comment: { select: { id: true, userId: true, deletedAt: true } },
  // Isi kartu dibaca langsung dari katalog, bukan disalin saat laporan dibuat:
  // setelah fixture diperbaiki dan di-seed, admin melihat versi barunya sebelum
  // menandai laporan selesai.
  vocab: { select: { ...VOCAB_CONTENT_SELECT, key: true, retiredAt: true } },
  bunpouPoint: { select: { key: true, level: true, retiredAt: true } },
  bunpouComparison: { select: { key: true, retiredAt: true } },
  post: { select: { id: true, userId: true, deletedAt: true } },
} satisfies Prisma.ReportSelect;

type ReportRow = Prisma.ReportGetPayload<{ select: typeof reportSelect }>;

/** Kata yang dilaporkan, dalam bentuk siap tampil untuk `VocabCardView`. */
export type ReportFlashcardTarget = {
  key: string;
  level: string;
  retiredAt: Date | null;
  content: VocabCardContent;
};

/** Pola atau perbandingan bunpou yang dilaporkan; isinya dilihat di halaman publiknya. */
export type ReportBunpouTarget =
  | { kind: "point"; key: string; level: string; retiredAt: Date | null }
  | { kind: "comparison"; key: string; retiredAt: Date | null };

export type ReportEntry = ReportRow & {
  /**
   * Tautan ke layar tempat laporan ini sebenarnya diperbaiki. `null` bila
   * targetnya sudah dihapus — barisnya tetap terbaca lewat `targetLabel` — dan
   * untuk kartu flashcard, yang tidak punya layar edit (lihat `flashcard`).
   */
  targetHref: string | null;
  /** Target yang pernah ada tetapi baris FK-nya sudah hilang (SET NULL). */
  targetMissing: boolean;
  /**
   * Kartu flashcard tidak diedit dari admin, jadi tidak ada tautan perbaikan;
   * isi kartunya ditampilkan di tempat bersama petunjuk perbaikan lewat fixture.
   */
  flashcard: ReportFlashcardTarget | null;
  /** Sama seperti `flashcard`: katalog bunpou diperbaiki lewat fixture, bukan admin. */
  bunpou: ReportBunpouTarget | null;
  /** Laporan lain yang belum selesai pada target yang sama. */
  otherOpenOnTarget: number;
  canReply: boolean;
};

function buildTargetHref(row: ReportRow): string | null {
  switch (row.targetType) {
    case "QUESTION":
      return row.questionId ? `/admin/question/${row.questionId}` : null;
    case "QUESTION_EXPLANATION":
      return row.questionId ? `/admin/explanation/${row.questionId}` : null;
    case "ARTICLE":
      return row.articleId ? `/admin/article/${row.articleId}` : null;
    // Komentar TIDAK punya layar sendiri di sini. Takedown sudah hidup di antrean
    // moderasi, dan jalur takedown kedua berarti dua tempat yang dapat berbeda
    // perlakuannya atas entri yang sama.
    case "COMMENT":
      return row.comment ? `/admin/moderation?state=all&user=${row.comment.userId}` : null;
    // Sama seperti komentar: takedown postingan hidup di antrean moderasi.
    case "POST":
      return row.post ? `/admin/moderation?kind=posts&state=all&user=${row.post.userId}` : null;
    // Katalog flashcard sengaja tidak punya editor admin: perbaikannya lewat
    // fixture lalu `seed:flashcard`. Isi kartu ditampilkan di antrean ini.
    // Bunpou juga tanpa editor admin; tautannya ke halaman publik supaya isi yang
    // sedang tayang bisa dibaca. Pola yang dipensiunkan sudah 404 di sana.
    case "BUNPOU_POINT":
      return row.bunpouPoint && !row.bunpouPoint.retiredAt
        ? `/bunpou/${row.bunpouPoint.key}`
        : null;
    case "BUNPOU_COMPARISON":
      return row.bunpouComparison && !row.bunpouComparison.retiredAt
        ? `/bunpou/compare/${row.bunpouComparison.key}`
        : null;
    case "FLASHCARD_VOCAB":
    case "GENERAL":
      return null;
  }
}

function isTargetMissing(row: ReportRow): boolean {
  switch (row.targetType) {
    case "QUESTION":
    case "QUESTION_EXPLANATION":
      return row.questionId === null;
    case "ARTICLE":
      return row.articleId === null;
    case "COMMENT":
      return row.comment === null;
    case "POST":
      return row.post === null;
    case "FLASHCARD_VOCAB":
      return row.vocab === null;
    case "BUNPOU_POINT":
      return row.bunpouPoint === null;
    case "BUNPOU_COMPARISON":
      return row.bunpouComparison === null;
    case "GENERAL":
      return false;
  }
}

function toFlashcardTarget(row: ReportRow): ReportFlashcardTarget | null {
  if (!row.vocab) return null;
  return {
    key: row.vocab.key,
    level: row.vocab.level,
    retiredAt: row.vocab.retiredAt,
    content: toCardContent(row.vocab),
  };
}

function toBunpouTarget(row: ReportRow): ReportBunpouTarget | null {
  if (row.bunpouPoint) {
    const { key, level, retiredAt } = row.bunpouPoint;
    return { kind: "point", key, level, retiredAt };
  }
  if (row.bunpouComparison) {
    const { key, retiredAt } = row.bunpouComparison;
    return { kind: "comparison", key, retiredAt };
  }
  return null;
}

function statusFilter(state: ReportQueryInput["state"]): Prisma.ReportWhereInput {
  if (state === "open") return { status: { in: OPEN_STATUSES } };
  if (state === "done") return { status: { in: DONE_STATUSES } };
  return {};
}

export async function listReportQueue(filter: ReportQueryInput) {
  const where: Prisma.ReportWhereInput = { ...statusFilter(filter.state) };
  if (filter.targetType) where.targetType = filter.targetType;
  if (filter.category) where.category = filter.category;
  if (filter.query) {
    where.OR = [
      { message: { contains: filter.query, mode: "insensitive" } },
      { targetLabel: { contains: filter.query, mode: "insensitive" } },
    ];
  }

  const [totalItems, byStatus] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / QUEUE_PAGE_SIZE));
  const page = Math.min(filter.page, totalPages);
  const sortDirection = filter.sort === "oldest" ? "asc" : "desc";
  const rows = await prisma.report.findMany({
    where,
    orderBy: [{ createdAt: sortDirection }, { id: sortDirection }],
    skip: (page - 1) * QUEUE_PAGE_SIZE,
    take: QUEUE_PAGE_SIZE,
    select: reportSelect,
  });

  const counts = { all: 0, open: 0, done: 0 };
  for (const group of byStatus) {
    counts.all += group._count._all;
    if (OPEN_STATUSES.includes(group.status)) counts.open += group._count._all;
    else counts.done += group._count._all;
  }

  // "Laporan lain pada target ini" dihitung hanya untuk target yang muncul di
  // halaman ini. Tanpa angka ini, dua belas orang yang melaporkan soal yang sama
  // terbaca sebagai dua belas pekerjaan berbeda.
  const openWhere: Prisma.ReportWhereInput = { status: { in: OPEN_STATUSES } };
  const questionIds = [...new Set(rows.flatMap((row) => (row.questionId ? [row.questionId] : [])))];
  const articleIds = [...new Set(rows.flatMap((row) => (row.articleId ? [row.articleId] : [])))];
  const commentIds = [...new Set(rows.flatMap((row) => (row.commentId ? [row.commentId] : [])))];
  const vocabIds = [...new Set(rows.flatMap((row) => (row.vocabId ? [row.vocabId] : [])))];
  const bunpouPointIds = [
    ...new Set(rows.flatMap((row) => (row.bunpouPointId ? [row.bunpouPointId] : []))),
  ];
  const bunpouComparisonIds = [
    ...new Set(rows.flatMap((row) => (row.bunpouComparisonId ? [row.bunpouComparisonId] : []))),
  ];
  const postIds = [...new Set(rows.flatMap((row) => (row.postId ? [row.postId] : [])))];

  const [
    questionGroups,
    articleGroups,
    commentGroups,
    vocabGroups,
    bunpouPointGroups,
    bunpouComparisonGroups,
    postGroups,
  ] = await Promise.all([
    questionIds.length
      ? prisma.report.groupBy({
          by: ["questionId"],
          where: { ...openWhere, questionId: { in: questionIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    articleIds.length
      ? prisma.report.groupBy({
          by: ["articleId"],
          where: { ...openWhere, articleId: { in: articleIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    commentIds.length
      ? prisma.report.groupBy({
          by: ["commentId"],
          where: { ...openWhere, commentId: { in: commentIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    vocabIds.length
      ? prisma.report.groupBy({
          by: ["vocabId"],
          where: { ...openWhere, vocabId: { in: vocabIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    bunpouPointIds.length
      ? prisma.report.groupBy({
          by: ["bunpouPointId"],
          where: { ...openWhere, bunpouPointId: { in: bunpouPointIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    bunpouComparisonIds.length
      ? prisma.report.groupBy({
          by: ["bunpouComparisonId"],
          where: { ...openWhere, bunpouComparisonId: { in: bunpouComparisonIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    postIds.length
      ? prisma.report.groupBy({
          by: ["postId"],
          where: { ...openWhere, postId: { in: postIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const openByQuestion = new Map(
    questionGroups.map((group) => [group.questionId, group._count._all]),
  );
  const openByArticle = new Map(articleGroups.map((group) => [group.articleId, group._count._all]));
  const openByComment = new Map(commentGroups.map((group) => [group.commentId, group._count._all]));
  const openByVocab = new Map(vocabGroups.map((group) => [group.vocabId, group._count._all]));
  const openByBunpouPoint = new Map(
    bunpouPointGroups.map((group) => [group.bunpouPointId, group._count._all]),
  );
  const openByBunpouComparison = new Map(
    bunpouComparisonGroups.map((group) => [group.bunpouComparisonId, group._count._all]),
  );
  const openByPost = new Map(postGroups.map((group) => [group.postId, group._count._all]));

  function otherOpenOnTarget(row: ReportRow) {
    const total = row.questionId
      ? openByQuestion.get(row.questionId)
      : row.articleId
        ? openByArticle.get(row.articleId)
        : row.commentId
          ? openByComment.get(row.commentId)
          : row.vocabId
            ? openByVocab.get(row.vocabId)
            : row.bunpouPointId
              ? openByBunpouPoint.get(row.bunpouPointId)
              : row.bunpouComparisonId
                ? openByBunpouComparison.get(row.bunpouComparisonId)
                : row.postId
                  ? openByPost.get(row.postId)
                  : undefined;
    if (total === undefined) return 0;
    // Baris ini sendiri ikut terhitung hanya bila statusnya masih terbuka.
    const includesSelf = OPEN_STATUSES.includes(row.status);
    return Math.max(0, total - (includesSelf ? 1 : 0));
  }

  const entries: ReportEntry[] = rows.map((row) => ({
    ...row,
    targetHref: buildTargetHref(row),
    targetMissing: isTargetMissing(row),
    flashcard: toFlashcardTarget(row),
    bunpou: toBunpouTarget(row),
    otherOpenOnTarget: otherOpenOnTarget(row),
    // Balasan hanya satu kali, dan hanya bila pelapor memang meninggalkan alamat.
    canReply: Boolean(row.replyEmail) && row.repliedAt === null,
  }));

  return {
    entries,
    counts,
    pagination: {
      page,
      pageSize: QUEUE_PAGE_SIZE,
      totalItems,
      totalPages,
    },
  };
}
