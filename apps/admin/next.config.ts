import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@kuapa-dwaso/dashboard-ui",
    "@kuapa-dwaso/design-tokens",
    "@kuapa-dwaso/types",
    "@kuapa-dwaso/ui"
  ]
};

export default nextConfig;
