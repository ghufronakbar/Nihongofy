import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { prisma } from "@/lib/prisma";
import {
  completedMockAttemptWhere,
  completedQuickPracticeWhere,
  completedSectionAttemptWhere,
} from "@/lib/activity-metrics";

export type ProfileOverview = {
  kanaLearned: number;
  flashcardStudied: number;
  quickPracticeCompleted: number;
  sectionPracticeCompleted: number;
  mockCompleted: number;
};

/**
 * Penghitung aktivitas satu akun, dipakai `/profile` (pemilik) dan `/u/[username]`
 * (siapa pun yang lolos `canViewProfileContent`).
 *
 * Sengaja di modul server-only, bukan di file "use server": setiap fungsi yang
 * diekspor dari file "use server" menjadi endpoint yang bisa dipanggil client
 * dengan `userId` sembarang — termasuk id akun private.
 *
 * Kana, practice, dan exam menginvalidasi tag-nya saat berubah. Review
 * flashcard tidak (jalurnya terlalu panas untuk invalidasi per review), jadi
 * `revalidate` yang menjaga "Kartu dipelajari" tidak basi lebih dari 10 menit.
 */
export function getProfileOverview(userId: number): Promise<ProfileOverview> {
  return unstable_cache(
    async (id: number) => {
      const [
        kanaLearned,
        flashcardStudied,
        quickPracticeCompleted,
        sectionPracticeCompleted,
        mockCompleted,
      ] = await Promise.all([
        prisma.kanaProgress.count({ where: { userId: id, correctCount: { gt: 0 } } }),
        // Kata unik: kata yang dipelajari di dua deck adalah dua kartu.
        prisma.$queryRaw<{ total: number }[]>`
          SELECT count(DISTINCT "vocabId")::int AS total
          FROM "FlashcardCard" WHERE "userId" = ${id} AND reps > 0
        `.then((rows) => rows[0]?.total ?? 0),
        prisma.practiceSession.count({ where: completedQuickPracticeWhere(id) }),
        prisma.attempt.count({ where: completedSectionAttemptWhere(id) }),
        prisma.attempt.count({ where: completedMockAttemptWhere(id) }),
      ]);

      return {
        kanaLearned,
        flashcardStudied,
        quickPracticeCompleted,
        sectionPracticeCompleted,
        mockCompleted,
      };
    },
    CACHE_KEYS.profileOverview(userId),
    { tags: [CACHE_TAGS.profileOverview(userId)], revalidate: 600 },
  )(userId);
}
