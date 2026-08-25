import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
