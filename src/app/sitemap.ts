import type { MetadataRoute } from "next";
import { FEATURES, SITE_URL, type FeatureName } from "@/constants";
import { getArticleSitemapEntries } from "@/features/article/queries";

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
  { path: "/article", changeFrequency: "weekly", priority: 0.8, feature: "article" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = FEATURES.article ? await getArticleSitemapEntries() : [];

  return [
    ...STATIC_ENTRIES.filter((entry) => !entry.feature || FEATURES[entry.feature]).map(
      (entry) => ({
        url: new URL(entry.path, SITE_URL).toString(),
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
      }),
    ),
    ...articles.map((article) => ({
      url: new URL(`/article/${article.slug}`, SITE_URL).toString(),
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
