import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/article", "/article/"],
      disallow: [
        "/api/",
        "/login",
        "/register",
        "/dashboard",
        "/analytics",
        "/history",
        "/progress",
        "/result",
        "/test-package",
        "/exam",
        "/exercises",
        "/kana",
        "/vocab",
        "/conversation",
        "/speaking",
        "/profile",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
