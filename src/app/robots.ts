import type { MetadataRoute } from "next";
import { FEATURES, SITE_URL } from "@/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        ...(FEATURES.article ? ["/article", "/article/"] : []),
        ...(FEATURES.testPackage ? ["/test-package", "/test-package/"] : []),
        ...(FEATURES.practice ? ["/exercises"] : []),
        ...(FEATURES.kana ? ["/kana", "/kana/"] : []),
        ...(FEATURES.flashcard ? ["/flashcard", "/flashcard/try/"] : []),
      ],
      disallow: [
        "/api/",
        "/conversation",
        "/speaking",
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
