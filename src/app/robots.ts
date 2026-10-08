import type { MetadataRoute } from "next";
import { FEATURES, SITE_URL } from "@/constants";
import { PRIVACY_PATH, TERMS_PATH } from "@/features/legal/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        // Landing unduhan mandiri, tidak terikat feature flag modul mana pun.
        "/gentsuki",
        // Dokumen hukum selalu terbuka, tanpa flag.
        PRIVACY_PATH,
        TERMS_PATH,
        ...(FEATURES.article ? ["/article", "/article/"] : []),
        ...(FEATURES.testPackage ? ["/test-package", "/test-package/"] : []),
        ...(FEATURES.practice ? ["/exercises"] : []),
        ...(FEATURES.kana ? ["/kana", "/kana/"] : []),
        ...(FEATURES.flashcard ? ["/flashcard", "/flashcard/try/"] : []),
        ...(FEATURES.bunpou ? ["/bunpou", "/bunpou/"] : []),
        // Diskusi pengguna diindeks sejak 2 Oktober 2026 supaya ikut membantu
        // orang yang mencari soal, kata, atau pola tertentu. `allow` yang lebih
        // spesifik mengalahkan `disallow: /flashcard/...` di bawah.
        ...(FEATURES.questionDiscussion ? ["/discussion"] : []),
        ...(FEATURES.flashcardDiscussion ? ["/flashcard/discussion"] : []),
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
