import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/park.json", destination: "/api/park" }];
  },
};

export default nextConfig;
