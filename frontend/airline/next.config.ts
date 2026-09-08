import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/airline/:path*",
        destination: "/:path*",
      },
    ];
  },
};

export default nextConfig;
