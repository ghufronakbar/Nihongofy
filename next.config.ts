import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font Jepang untuk report PDF /progress dibaca lewat fs saat runtime, jadi
  // harus ikut dibundel ke function route-nya secara eksplisit.
  outputFileTracingIncludes: {
    "/api/progress/report": ["./assets/fonts/**/*"],
    // Server Actions can run on every page containing a DictionaryScope.
    // Only compressed, prebuilt shards are packaged, never the source archive.
    "/*": ["./assets/dictionary/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/first-time-setup",
        destination: "/register",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
