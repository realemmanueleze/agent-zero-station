import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@station/channels", "@station/packs"],
  async rewrites() {
    return [{ source: "/park.json", destination: "/api/park" }];
  },
};

export default nextConfig;
