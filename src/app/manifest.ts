import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - Belajar Bahasa Jepang & Simulasi JLPT`,
    short_name: SITE_NAME,
    description: "Platform belajar bahasa Jepang & simulasi latihan JLPT terstruktur.",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eaf2ff",
    theme_color: "#facc00",
    categories: ["education"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      // Android mengabaikan ikon SVG saat menilai kelayakan install, jadi dua
      // varian PNG di bawah ini yang sebenarnya menentukan bisa/tidaknya
      // aplikasi dipasang ke homescreen.
      {
        src: "/app-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon/maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
