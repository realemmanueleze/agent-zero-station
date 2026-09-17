import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  transpilePackages: ["@station/channels", "@station/packs"],
  async rewrites() {
    return [{ source: "/park.json", destination: "/api/park" }];
  },
};

export default nextConfig;
