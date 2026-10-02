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
        ...(FEATURES.bunpou ? ["/bunpou", "/bunpou/"] : []),
      ],
      disallow: [
        "/api/",
        // Turunan modul yang halaman indeksnya tetap dibuka: sesi latihan dan
        // koleksi flashcard pribadi tidak punya nilai pencarian, dan aturan yang
        // lebih spesifik mengalahkan `allow` di atasnya.
        "/exercises/",
        "/flashcard/add",
        "/flashcard/settings",
        "/flashcard/stats",
        "/flashcard/deck/",
        // Catatan buatan pengguna, belum ada moderasi. Dibuka untuk diindeks
        // nanti bersamaan dengan dashboard admin.
        "/discussion",
        "/conversation",
        "/speaking",
        // Form laporan publik. `noindex` di halamannya yang menjadi penjaga utama;
        // baris ini supaya crawler tidak menjadikannya pintu masuk spam.
        "/report",
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
