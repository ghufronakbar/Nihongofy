import "server-only";

import { cache } from "react";
import type { FollowStatus, Prisma } from "@prisma/client";
import { FEATURES } from "@/constants";
import { prisma } from "@/lib/prisma";

// Semua query follow dibaca per request, tanpa `unstable_cache`: status follow
// ikut menentukan siapa boleh melihat isi akun private, dan jumlahnya berubah
// setiap kali seseorang menekan tombol. Index (followingId|followerId, status,
// createdAt) menopang semuanya.

/** Akun lawan yang dihitung dan ditampilkan: bukan anonim, tidak menunggu penghapusan. */
const availableUser = { anonymizedAt: null, deletionRequestedAt: null } satisfies Prisma.UserWhereInput;

export const FOLLOW_PAGE_SIZE = 30;

/**
 * Status follow viewer ke pemilik profil, atau null bila belum mengikuti,
 * viewer guest/pemilik sendiri, atau fitur follow mati. Null saat flag mati
 * berarti follower lama tidak lagi membuka akun private — sesuai rancangan.
 */
export const getViewerFollowStatus = cache(
  async (viewerId: number | null, ownerId: number): Promise<FollowStatus | null> => {
    if (!FEATURES.follow || viewerId === null || viewerId === ownerId) return null;
    const row = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      select: { status: true },
    });
    return row?.status ?? null;
  },
);

export type FollowCounts = { followers: number; following: number };

export async function getFollowCounts(userId: number): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId, status: "ACCEPTED", follower: availableUser } }),
    prisma.follow.count({ where: { followerId: userId, status: "ACCEPTED", following: availableUser } }),
  ]);
  return { followers, following };
}

/** Badge permintaan follow masuk. Didedup karena layout dan halaman sama-sama memintanya. */
export const countPendingFollowRequests = cache(async (userId: number) => {
  if (!FEATURES.follow) return 0;
  return prisma.follow.count({ where: { followingId: userId, status: "PENDING", follower: availableUser } });
});

export type FollowListUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
};

export type FollowListPage = {
  users: (FollowListUser & { since: Date })[];
  /** Id akun terakhir di halaman ini, untuk `?after=`; null bila tidak ada lanjutan. */
  nextCursor: number | null;
};

const listUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
} satisfies Prisma.UserSelect;

/**
 * Satu halaman daftar follow, terbaru dulu. Kursornya id akun lawan pada
 * halaman sebelumnya; pemiliknya tetap, jadi bersama-sama membentuk PK baris.
 * Mengambil satu baris lebih banyak supaya `nextCursor` tidak butuh COUNT.
 */
export async function listFollows({
  userId,
  direction,
  status,
  after,
}: {
  userId: number;
  /** `followers`: yang mengikuti userId. `following`: yang diikuti userId. */
  direction: "followers" | "following";
  status: FollowStatus;
  after: number | null;
}): Promise<FollowListPage> {
  const isFollowers = direction === "followers";
  const rows = await prisma.follow.findMany({
    where: isFollowers
      ? { followingId: userId, status, follower: availableUser }
      : { followerId: userId, status, following: availableUser },
    orderBy: [{ createdAt: "desc" }, isFollowers ? { followerId: "desc" } : { followingId: "desc" }],
    take: FOLLOW_PAGE_SIZE + 1,
    ...(after !== null
      ? {
          skip: 1,
          cursor: {
            followerId_followingId: isFollowers
              ? { followerId: after, followingId: userId }
              : { followerId: userId, followingId: after },
          },
        }
      : {}),
    select: {
      createdAt: true,
      follower: isFollowers ? { select: listUserSelect } : false,
      following: isFollowers ? false : { select: listUserSelect },
    },
  });

  const page = rows.slice(0, FOLLOW_PAGE_SIZE);
  const users = page.flatMap((row) => {
    const user = isFollowers ? row.follower : row.following;
    return user ? [{ ...user, since: row.createdAt }] : [];
  });
  return {
    users,
    nextCursor: rows.length > FOLLOW_PAGE_SIZE ? (users.at(-1)?.id ?? null) : null,
  };
}
