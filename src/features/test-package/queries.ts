import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_KEYS, CACHE_TAGS } from "@/constants/cache-key";
import { JLPT_SESSION_TIMING } from "@/constants/jlpt";

/**
 * Query publik untuk metadata, OG image, dan sitemap paket ujian.
 *
 * Sengaja dipisahkan dari `actions.ts`: fungsi di sana memanggil `getSession()`
 * untuk riwayat attempt, dan memakainya di `generateMetadata` akan membuat
 * metadata bergantung pada cookie sehingga halaman batal di-prerender.
 */
const getCachedTestPackageMetadata = (testPackageId: number) =>
  unstable_cache(
    async (id: number) =>
      prisma.testPackage.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          jlptLevel: true,
          updatedAt: true,
          testPackageItems: {
            select: {
              section: true,
              _count: { select: { questions: true } },
            },
          },
        },
      }),
    CACHE_KEYS.testPackageMetadata(testPackageId),
    { tags: [CACHE_TAGS.testPackageDetail(testPackageId)] },
  )(testPackageId);

export type TestPackageMetadata = {
  id: number;
  name: string;
  jlptLevel: keyof typeof JLPT_SESSION_TIMING;
  updatedAt: Date;
  mondaiCount: number;
  questionCount: number;
  /** Jumlah sesi ujian resmi untuk level ini, bukan jumlah blok mondai. */
  sessionCount: number;
  /** Total durasi resmi seluruh sesi, dalam menit. */
  totalMinutes: number;
  sectionCount: number;
};

export async function getTestPackageMetadata(
  testPackageId: number,
): Promise<TestPackageMetadata | null> {
  const testPackage = await getCachedTestPackageMetadata(testPackageId);
  if (!testPackage) return null;

  const timing = JLPT_SESSION_TIMING[testPackage.jlptLevel];

  return {
    id: testPackage.id,
    name: testPackage.name,
    jlptLevel: testPackage.jlptLevel,
    updatedAt: new Date(testPackage.updatedAt),
    mondaiCount: testPackage.testPackageItems.length,
    questionCount: testPackage.testPackageItems.reduce(
      (total, item) => total + item._count.questions,
      0,
    ),
    sessionCount: timing.length,
    totalMinutes: timing.reduce((total, session) => total + session.durationMinutes, 0),
    sectionCount: new Set(testPackage.testPackageItems.map((item) => item.section)).size,
  };
}

const getCachedTestPackageSitemapEntries = unstable_cache(
  async () =>
    prisma.testPackage.findMany({
      select: { id: true, updatedAt: true },
      orderBy: { id: "asc" },
    }),
  CACHE_KEYS.testPackageSitemap,
  { tags: [CACHE_TAGS.testPackageList], revalidate: 3600 },
);

export async function getTestPackageSitemapEntries() {
  const entries = await getCachedTestPackageSitemapEntries();
  return entries.map((entry) => ({ ...entry, updatedAt: new Date(entry.updatedAt) }));
}
