import type { MetadataRoute } from "next";
import { FEATURES, SITE_URL, type FeatureName } from "@/constants";
import { getArticleSitemapEntries } from "@/features/article/queries";
import { getBunpouSitemapEntries } from "@/features/bunpou/queries";
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
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, testPackages, bunpou] = await Promise.all([
    FEATURES.article ? getArticleSitemapEntries() : [],
    FEATURES.testPackage ? getTestPackageSitemapEntries() : [],
    FEATURES.bunpou ? getBunpouSitemapEntries() : { points: [], comparisons: [] },
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
    ...articles.map((article) => ({
      url: new URL(`/article/${article.slug}`, SITE_URL).toString(),
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
