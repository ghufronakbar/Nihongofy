import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants";
import { getArticleSitemapEntries } from "@/features/article/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticleSitemapEntries();

  return [
    {
      url: new URL("/", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/test-package", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: new URL("/exercises", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: new URL("/kana/hiragana", SITE_URL).toString(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: new URL("/kana/katakana", SITE_URL).toString(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: new URL("/flashcard", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: new URL("/article", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...articles.map((article) => ({
      url: new URL(`/article/${article.slug}`, SITE_URL).toString(),
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
