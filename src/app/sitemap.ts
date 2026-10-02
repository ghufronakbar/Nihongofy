import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { FEATURES, SITE_URL, type FeatureName } from "@/constants";
import { getArticleSitemapEntries } from "@/features/article/queries";
import { getBunpouSitemapEntries } from "@/features/bunpou/queries";
import { getDiscussionSitemapTargets } from "@/features/question-comment/queries";
import { PRIVACY_PATH, TERMS_PATH } from "@/features/legal/constants";
import { CACHE_KEYS } from "@/constants/cache-key";
import { getTestPackageSitemapEntries } from "@/features/test-package/queries";

type StaticEntry = {
  path: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
  feature?: FeatureName;
};

const STATIC_ENTRIES: StaticEntry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/test-package", changeFrequency: "weekly", priority: 0.9, feature: "testPackage" },
  { path: "/exercises", changeFrequency: "weekly", priority: 0.85, feature: "practice" },
  { path: "/kana/hiragana", changeFrequency: "monthly", priority: 0.8, feature: "kana" },
  { path: "/kana/katakana", changeFrequency: "monthly", priority: 0.8, feature: "kana" },
  { path: "/flashcard", changeFrequency: "weekly", priority: 0.8, feature: "flashcard" },
  { path: "/bunpou", changeFrequency: "weekly", priority: 0.8, feature: "bunpou" },
  { path: "/article", changeFrequency: "weekly", priority: 0.8, feature: "article" },
  { path: "/discussion", changeFrequency: "weekly", priority: 0.5, feature: "questionDiscussion" },
  {
    path: "/flashcard/discussion",
    changeFrequency: "weekly",
    priority: 0.5,
    feature: "flashcardDiscussion",
  },
  { path: "/bunpou/discussion", changeFrequency: "weekly", priority: 0.5, feature: "bunpouDiscussion" },
  // Dokumen hukum tanpa flag: selalu ada, apa pun modul yang aktif.
  { path: PRIVACY_PATH, changeFrequency: "monthly", priority: 0.3 },
  { path: TERMS_PATH, changeFrequency: "monthly", priority: 0.3 },
];

// Hanya halaman diskusi yang punya entri tampil; halaman kosong diberi `noindex`.
// Diskusi pola tidak perlu: pola sudah masuk sitemap dan diskusinya ada di halaman itu.
const getCachedDiscussionTargets = unstable_cache(
  async () => {
    const targets = await getDiscussionSitemapTargets();
    return {
      questions: targets.questions.map((row) => ({
        id: row.id,
        lastActivityAt: row.lastActivityAt.toISOString(),
      })),
      vocabs: targets.vocabs.map((row) => ({
        id: row.id,
        lastActivityAt: row.lastActivityAt.toISOString(),
      })),
    };
  },
  CACHE_KEYS.discussionSitemap,
  { revalidate: 3600 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, testPackages, bunpou, discussions] = await Promise.all([
    FEATURES.article ? getArticleSitemapEntries() : [],
    FEATURES.testPackage ? getTestPackageSitemapEntries() : [],
    FEATURES.bunpou ? getBunpouSitemapEntries() : { points: [], comparisons: [] },
    FEATURES.questionDiscussion || FEATURES.flashcardDiscussion
      ? getCachedDiscussionTargets()
      : { questions: [], vocabs: [] },
  ]);

  return [
    ...STATIC_ENTRIES.filter((entry) => !entry.feature || FEATURES[entry.feature]).map(
      (entry) => ({
        url: new URL(entry.path, SITE_URL).toString(),
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
      }),
    ),
    // Detail paket dan mode bacanya adalah halaman konten terbanyak di situs ini
    // sesudah artikel; tanpa entri di sini keduanya hanya bisa ditemukan lewat
    // link dari katalog.
    ...testPackages.flatMap((testPackage) => [
      {
        url: new URL(`/test-package/${testPackage.id}`, SITE_URL).toString(),
        lastModified: testPackage.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.75,
      },
      {
        url: new URL(`/test-package/${testPackage.id}/questions`, SITE_URL).toString(),
        lastModified: testPackage.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      },
    ]),
    ...bunpou.points.map((point) => ({
      url: new URL(`/bunpou/${point.key}`, SITE_URL).toString(),
      lastModified: point.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...bunpou.comparisons.map((comparison) => ({
      url: new URL(`/bunpou/compare/${comparison.key}`, SITE_URL).toString(),
      lastModified: comparison.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    ...(FEATURES.questionDiscussion ? discussions.questions : []).map((question) => ({
      url: new URL(`/discussion/question/${question.id}`, SITE_URL).toString(),
      lastModified: new Date(question.lastActivityAt),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...(FEATURES.flashcardDiscussion ? discussions.vocabs : []).map((vocab) => ({
      url: new URL(`/flashcard/discussion/${vocab.id}`, SITE_URL).toString(),
      lastModified: new Date(vocab.lastActivityAt),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...articles.map((article) => ({
      url: new URL(`/article/${article.slug}`, SITE_URL).toString(),
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
