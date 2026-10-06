import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font Jepang untuk report PDF /progress dibaca lewat fs saat runtime, jadi
  // harus ikut dibundel ke function route-nya secara eksplisit.
  outputFileTracingIncludes: {
    "/api/progress/report": ["./assets/fonts/**/*"],
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
