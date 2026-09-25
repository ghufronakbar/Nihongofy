import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nihongofy",
    short_name: "Nihongofy",
    description: "Platform belajar bahasa Jepang & simulasi latihan JLPT terstruktur.",
    start_url: "/",
    display: "standalone",
    background_color: "#eaf2ff",
    theme_color: "#facc00",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
