import "server-only";

import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { FEATURES } from "@/constants";
import { prisma } from "@/lib/prisma";
import { canViewProfileContent, isProfileUnavailable, profilePath } from "@/features/public-profile/access";
import { getViewerFollowStatus } from "@/features/public-profile/follow-queries";
import { getPostCommentCounts, type DiscussionAuthor } from "@/features/question-comment/queries";

// Feed, thread, dan hitungannya tidak di-`unstable_cache`, sama seperti diskusi:
// isinya berubah setiap ada postingan, like, atau komentar, dan siapa yang boleh
// melihat bergantung pada visibility serta status follow yang dibaca per request.

export const POST_PAGE_SIZE = 20;

/** Penulis yang postingannya boleh tampil sama sekali: bukan anonim, tidak menunggu penghapusan. */
const availableAuthor = { anonymizedAt: null, deletionRequestedAt: null } satisfies Prisma.UserWhereInput;

const postSelect = {
  id: true,
  text: true,
  images: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      profileVisibility: true,
    },
  },
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

export type PostState = "VISIBLE" | "DELETED";

export type PostCardData = {
  id: number;
  state: PostState;
  createdAt: Date;
  // Empat field di bawah hanya terisi saat state === "VISIBLE". Untuk tombstone
  // isinya tidak ikut diambil dari baris database, sama seperti
  // `toDiscussionRoot`: teks dan gambar yang sudah dihapus tidak pernah sampai
  // ke browser.
  text: string | null;
  images: string[];
  editedAt: Date | null;
  author: DiscussionAuthor | null;
  likeCount: number;
  /** Selalu false untuk guest. */
  viewerLiked: boolean;
  commentCount: number;
};

function toPostCard(row: PostRow): PostCardData {
  if (row.deletedAt) {
    return {
      id: row.id,
      state: "DELETED",
      createdAt: row.createdAt,
      text: null,
      images: [],
      editedAt: null,
      author: null,
      likeCount: 0,
      viewerLiked: false,
      commentCount: 0,
    };
  }
  return {
    id: row.id,
    state: "VISIBLE",
    createdAt: row.createdAt,
    text: row.text,
    images: row.images,
    editedAt: row.editedAt,
    author: {
      id: row.user.id,
      username: row.user.username,
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarUrl,
      profilePath: profilePath(row.user.username, FEATURES.publicProfile),
    },
    likeCount: 0,
    viewerLiked: false,
    commentCount: 0,
  };
}

/** Jumlah like dan komentar, plus status like milik viewer; satu query per jenis. */
async function withPostStats(cards: PostCardData[], viewerId: number | null): Promise<PostCardData[]> {
  const ids = cards.map((card) => card.id);
  if (ids.length === 0) return cards;

  const [likes, comments, viewerLikes] = await Promise.all([
    prisma.postLike.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
    getPostCommentCounts(ids),
    viewerId === null
      ? Promise.resolve([])
      : prisma.postLike.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
  ]);
  const likeCount = new Map(likes.map((row) => [row.postId, row._count._all]));
  const liked = new Set(viewerLikes.map((row) => row.postId));

  return cards.map((card) => ({
    ...card,
    // Tombstone tidak membawa jumlah like: angka itu bagian dari isi yang ditarik.
    likeCount: card.state === "VISIBLE" ? (likeCount.get(card.id) ?? 0) : 0,
    viewerLiked: card.state === "VISIBLE" && liked.has(card.id),
    commentCount: comments.get(card.id) ?? 0,
  }));
}

export type PostPage = {
  posts: PostCardData[];
  /** Id postingan terakhir untuk `?before=`; null bila tidak ada lanjutan. */
  nextCursor: number | null;
};

async function pageOf(where: Prisma.PostWhereInput, before: number | null, viewerId: number | null): Promise<PostPage> {
  const rows = await prisma.post.findMany({
    where: { ...where, ...(before ? { id: { lt: before } } : {}) },
    // Urutan id = urutan dibuat; kursor id tidak butuh COUNT dan tidak bergeser
    // saat postingan baru masuk di atas.
    orderBy: { id: "desc" },
    take: POST_PAGE_SIZE + 1,
    select: postSelect,
  });
  const page = rows.slice(0, POST_PAGE_SIZE);
  return {
    posts: await withPostStats(page.map(toPostCard), viewerId),
    nextCursor: rows.length > POST_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
  };
}

/**
 * Feed global: postingan hidup dari akun PUBLIC. Postingan akun private disaring
 * keluar di sini, bukan ditampilkan sebagai kartu "akun private" — kartu kosong
 * tetap membocorkan kapan dan seberapa sering pemiliknya memposting. Sama untuk
 * semua viewer kecuali status like miliknya.
 */
export function getGlobalFeed(before: number | null, viewerId: number | null) {
  return pageOf({ deletedAt: null, user: { ...availableAuthor, profileVisibility: "PUBLIC" } }, before, viewerId);
}

/**
 * Tab "Mengikuti": postingan viewer sendiri dan akun yang ia ikuti dengan status
 * ACCEPTED, termasuk akun private yang sudah menyetujuinya.
 */
export function getFollowingFeed(viewerId: number, before: number | null) {
  return pageOf(
    {
      deletedAt: null,
      user: {
        ...availableAuthor,
        OR: [{ id: viewerId }, { followedBy: { some: { followerId: viewerId, status: "ACCEPTED" } } }],
      },
    },
    before,
    viewerId,
  );
}

/** Postingan satu akun untuk profilnya. Pemanggil wajib sudah lolos `canViewProfileContent`. */
export function getUserPosts(userId: number, before: number | null, viewerId: number | null) {
  return pageOf({ userId, deletedAt: null }, before, viewerId);
}

export type PostAccess = {
  id: number;
  authorId: number;
  authorUsername: string;
  deletedAt: Date | null;
  /** Viewer boleh melihat isi dan berinteraksi (like, komentar). */
  canView: boolean;
};

/**
 * Siapa yang boleh melihat sebuah postingan: aturan yang sama dengan isi profil
 * penulisnya (`canViewProfileContent`). Dipakai halaman permalink dan setiap
 * action yang menyentuh postingan orang lain — like, komentar, laporan.
 * Postingan dari akun anonim atau yang menunggu penghapusan dianggap tidak ada.
 */
export const getPostAccess = cache(async (postId: number, viewerId: number | null): Promise<PostAccess | null> => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      deletedAt: true,
      user: {
        select: {
          username: true,
          profileVisibility: true,
          anonymizedAt: true,
          deletionRequestedAt: true,
        },
      },
    },
  });
  if (!post || isProfileUnavailable(post.user)) return null;

  const followStatus = await getViewerFollowStatus(viewerId, post.userId);
  return {
    id: post.id,
    authorId: post.userId,
    authorUsername: post.user.username,
    deletedAt: post.deletedAt,
    canView: canViewProfileContent(
      { id: post.userId, profileVisibility: post.user.profileVisibility },
      viewerId,
      followStatus,
    ),
  };
});

/**
 * Satu postingan untuk permalink. Postingan yang dihapus hanya dikembalikan
 * (sebagai tombstone) bila masih punya komentar hidup; tanpa komentar, tidak ada
 * yang perlu diberi konteks dan halamannya 404.
 */
export async function getPostDetail(postId: number, viewerId: number | null): Promise<PostCardData | null> {
  const row = await prisma.post.findUnique({ where: { id: postId }, select: postSelect });
  if (!row) return null;
  const [card] = await withPostStats([toPostCard(row)], viewerId);
  if (!card) return null;
  if (card.state === "DELETED" && card.commentCount === 0) return null;
  return card;
}

/** Jumlah postingan hidup satu akun, untuk header profil. */
export function countUserPosts(userId: number) {
  return prisma.post.count({ where: { userId, deletedAt: null } });
}

/** Keadaan viewer yang memengaruhi kotak tulis dan tombol di feed. */
export async function getCommunityViewer(viewerId: number | null) {
  if (viewerId === null) return { viewerId, postingSuspended: false, isPrivateAccount: false };
  const user = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { profileVisibility: true, postingSuspendedAt: true },
  });
  return {
    viewerId,
    // Dibaca langsung, tidak di-cache, sama seperti `isPostingSuspended`.
    postingSuspended: Boolean(user?.postingSuspendedAt),
    isPrivateAccount: user?.profileVisibility === "PRIVATE",
  };
}
