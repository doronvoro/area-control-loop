import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large CSV uploads for pesticide registry import (up to 60MB)
    proxyClientMaxBodySize: '60mb',
  },
};

export default nextConfig;
