import "server-only";

import { cache } from "react";
import { Prisma, type JlptLevel, type ProfileVisibility } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { FEATURES } from "@/constants";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_TIME_ZONE,
  getUtcDateBoundary,
  getZonedCalendarDate,
  isValidTimeZone,
} from "@/lib/time-zone";
import { isProfileUnavailable } from "./access";
import { UsernameParamSchema } from "./schemas";
import {
  activityWindowStart,
  summarizeActivity,
  type ActivityDayRow,
  type ActivitySummary,
  type CalendarDate,
} from "./activity";

export type PublicProfileOwner = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  jlptTarget: JlptLevel | null;
  profileVisibility: ProfileVisibility;
  timeZone: string;
  createdAt: Date;
};

/**
 * Pemilik profil berdasarkan username, atau null bila tidak ada / tidak
 * tersedia (anonim, menunggu penghapusan).
 *
 * TIDAK di-`unstable_cache`: visibility harus dibaca per request supaya akun
 * yang baru beralih ke private langsung tertutup. `cache` dari React hanya
 * mendedup pemanggilan `generateMetadata` dan page di request yang sama.
 */
export const getPublicProfileOwner = cache(async (username: string): Promise<PublicProfileOwner | null> => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      jlptTarget: true,
      profileVisibility: true,
      timeZone: true,
      createdAt: true,
      anonymizedAt: true,
      deletionRequestedAt: true,
    },
  });
  if (!user || isProfileUnavailable(user)) return null;

  // Penanda lifecycle akun tidak ikut keluar dari modul ini.
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    jlptTarget: user.jlptTarget,
    profileVisibility: user.profileVisibility,
    timeZone: user.timeZone,
    createdAt: user.createdAt,
  };
});

export type ResolvedProfile =
  | { kind: "missing" }
  | { kind: "redirect"; username: string }
  | { kind: "found"; owner: PublicProfileOwner };

/**
 * Param `[username]` → pemilik profil. Username selalu disimpan lowercase;
 * variasi huruf besar diarahkan ke satu URL canonical alih-alih menjadi halaman
 * duplikat, jadi pemanggil wajib menangani `redirect`.
 */
export async function resolveProfileParam(raw: string): Promise<ResolvedProfile> {
  const parsed = UsernameParamSchema.safeParse(raw);
  if (!parsed.success) return { kind: "missing" };

  const username = parsed.data.toLowerCase();
  if (username !== parsed.data) return { kind: "redirect", username };

  const owner = await getPublicProfileOwner(username);
  return owner ? { kind: "found", owner } : { kind: "missing" };
}

// ============================================================
// HEATMAP AKTIVITAS
// ============================================================

/** Hari kalender dari kolom timestamp UTC, di timezone pemilik. */
function localDay(column: Prisma.Sql, timeZone: string) {
  return Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date`;
}

function utcTimestamp(date: Date) {
  return Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/**
 * Sumber heatmap mengikuti flag modulnya, sama seperti kartu statistik:
 * aktivitas modul yang dimatikan tidak tampil.
 *
 * Revlog `MANUAL`/`RESCHEDULED` dibuang karena itu penjadwalan ulang kartu oleh
 * user, bukan belajar.
 *
 * Setiap cabang menamai kolomnya sendiri: UNION mengambil nama dari cabang
 * pertama, dan cabang pertama berubah-ubah mengikuti flag yang hidup.
 */
function activitySources(userId: number, timeZone: string, since: Date) {
  const lowerBound = utcTimestamp(since);
  const sources: Prisma.Sql[] = [];

  if (FEATURES.flashcard) {
    sources.push(Prisma.sql`
      SELECT ${localDay(Prisma.sql`"reviewedAt"`, timeZone)} AS day, 1 AS flashcard, 0 AS practice, 0 AS exam
      FROM "FlashcardRevlog"
      WHERE "userId" = ${userId} AND "reviewedAt" >= ${lowerBound}
        AND kind NOT IN ('MANUAL', 'RESCHEDULED')
    `);
  }
  if (FEATURES.practice) {
    sources.push(Prisma.sql`
      SELECT ${localDay(Prisma.sql`"finishedAt"`, timeZone)} AS day, 0 AS flashcard, 1 AS practice, 0 AS exam
      FROM "PracticeSession"
      WHERE "userId" = ${userId} AND status = 'COMPLETED' AND "finishedAt" >= ${lowerBound}
    `);
  }
  if (FEATURES.testPackage) {
    sources.push(Prisma.sql`
      SELECT ${localDay(Prisma.sql`"finishedAt"`, timeZone)} AS day, 0 AS flashcard, 0 AS practice, 1 AS exam
      FROM "Attempt"
      WHERE "userId" = ${userId} AND status = 'COMPLETED' AND "finishedAt" >= ${lowerBound}
    `);
  }

  return sources;
}

/** Apakah heatmap punya sumber sama sekali di konfigurasi flag sekarang. */
export const HEATMAP_ENABLED = FEATURES.flashcard || FEATURES.practice || FEATURES.testPackage;

const FLAG_SIGNATURE = [
  FEATURES.flashcard,
  FEATURES.practice,
  FEATURES.testPackage,
  FEATURES.questionDiscussion,
  FEATURES.flashcardDiscussion,
  FEATURES.bunpouDiscussion,
  FEATURES.community,
]
  .map(Number)
  .join("");

/**
 * Baris per hari untuk 365 hari terakhir.
 *
 * Kunci cache memuat hari pertama jendela, jadi pergantian hari otomatis
 * memakai entri baru tanpa menunggu `revalidate`. Tag `profileOverview` ikut
 * diinvalidasi oleh kana/practice/exam; review flashcard mengandalkan
 * `revalidate` (lihat `getProfileOverview`).
 *
 * Flag ikut di kunci karena Data Cache Vercel bertahan lintas deployment,
 * sedangkan flag baru berubah lewat redeploy.
 */
function getActivityRows(userId: number, timeZone: string, windowStart: string) {
  return unstable_cache(
    async (): Promise<ActivityDayRow[]> => {
      const sources = activitySources(
        userId,
        timeZone,
        getUtcDateBoundary(windowStart, timeZone, "start") ?? new Date(`${windowStart}T00:00:00Z`),
      );
      if (sources.length === 0) return [];

      return prisma.$queryRaw<ActivityDayRow[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day,
               sum(flashcard)::int AS flashcard,
               sum(practice)::int AS practice,
               sum(exam)::int AS exam
        FROM (${Prisma.join(sources, " UNION ALL ")}) AS activity
        WHERE day >= ${windowStart}::date
        GROUP BY day
      `;
    },
    [...CACHE_KEYS.publicProfileActivity(userId), timeZone, windowStart, FLAG_SIGNATURE],
    { tags: [CACHE_TAGS.profileOverview(userId)], revalidate: 600 },
  )();
}

export type ProfileActivity = {
  summary: ActivitySummary;
  /** Hanya hari yang punya aktivitas — bentuk ringkas untuk dikirim ke client. */
  rows: ActivityDayRow[];
  today: CalendarDate;
};

export async function getProfileActivity(owner: Pick<PublicProfileOwner, "id" | "timeZone">): Promise<ProfileActivity> {
  const timeZone = isValidTimeZone(owner.timeZone) ? owner.timeZone : DEFAULT_TIME_ZONE;
  const today = getZonedCalendarDate(new Date(), timeZone);
  const rows = await getActivityRows(owner.id, timeZone, activityWindowStart(today));
  return { summary: summarizeActivity(rows, today), rows, today };
}

// ============================================================
// REPUTASI DISKUSI
// ============================================================

export type ProfileCommunityStats = {
  /** Entri diskusi publik yang sedang tampil. */
  entries: number;
  /** Suara "Membantu" yang diterima entri-entri tersebut. */
  helpful: number;
};

/** Ada permukaan diskusi yang hidup, sehingga reputasi bermakna untuk ditampilkan. */
export const COMMUNITY_STATS_ENABLED =
  FEATURES.questionDiscussion || FEATURES.flashcardDiscussion || FEATURES.bunpouDiscussion || FEATURES.community;

/**
 * Hanya entri yang memang terlihat publik yang dihitung — aturan tampilnya
 * sama dengan `toDiscussionRoot()`:
 * - root: `PUBLIC` dan belum dihapus;
 * - balasan: belum dihapus, di thread yang pernah dibagikan (`sharedAt`). Balasan
 *   di bawah root tombstone tetap tampil, jadi tetap dihitung.
 * Target yang flag diskusinya mati dibuang, karena entrinya tidak tampil di mana
 * pun.
 *
 * Reputasi "Membantu" = suara pada entri tersebut + like pada postingan hidup
 * milik user (bila komunitas aktif). Like pada postingan yang dihapus atau
 * di-takedown tidak dihitung.
 */
export function getProfileCommunityStats(userId: number) {
  return unstable_cache(
    async (): Promise<ProfileCommunityStats> => {
      const targets: Prisma.Sql[] = [];
      if (FEATURES.questionDiscussion) targets.push(Prisma.sql`c."questionId" IS NOT NULL`);
      if (FEATURES.flashcardDiscussion) targets.push(Prisma.sql`c."vocabId" IS NOT NULL`);
      if (FEATURES.bunpouDiscussion) targets.push(Prisma.sql`c."bunpouPointId" IS NOT NULL`);
      if (FEATURES.community) targets.push(Prisma.sql`c."postId" IS NOT NULL`);
      if (targets.length === 0) return { entries: 0, helpful: 0 };
      const postLikes = FEATURES.community
        ? Prisma.sql`(SELECT count(*)::int FROM "PostLike" l JOIN "Post" ps ON ps.id = l."postId" WHERE ps."userId" = ${userId} AND ps."deletedAt" IS NULL)`
        : Prisma.sql`0`;

      const rows = await prisma.$queryRaw<ProfileCommunityStats[]>`
        WITH visible AS (
          SELECT c.id
          FROM "QuestionComment" c
          LEFT JOIN "QuestionComment" p ON p.id = c."parentId"
          WHERE c."userId" = ${userId}
            AND c."deletedAt" IS NULL
            AND (${Prisma.join(targets, " OR ")})
            AND (
              (c."parentId" IS NULL AND c.visibility = 'PUBLIC')
              OR (c."parentId" IS NOT NULL AND p."sharedAt" IS NOT NULL)
            )
        )
        SELECT
          (SELECT count(*)::int FROM visible) AS entries,
          (SELECT count(*)::int FROM "QuestionCommentVote" v JOIN visible ON visible.id = v."commentId")
            + ${postLikes} AS helpful
      `;
      return rows[0] ?? { entries: 0, helpful: 0 };
    },
    [...CACHE_KEYS.publicProfileCommunity(userId), FLAG_SIGNATURE],
    { revalidate: 600 },
  )();
}
