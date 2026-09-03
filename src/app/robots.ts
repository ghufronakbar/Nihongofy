import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/article",
        "/article/",
        "/test-package",
        "/test-package/",
        "/exercises",
        "/kana",
        "/kana/",
        "/flashcard",
        "/flashcard/try/",
      ],
      disallow: [
        "/api/",
        "/login",
        "/register",
        "/verify-email",
        "/forget-password",
        "/dashboard",
        "/analytics",
        "/history",
        "/progress",
        "/result",
        "/exam",
        "/profile",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
