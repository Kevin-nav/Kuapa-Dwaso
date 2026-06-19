import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agriculture/design-tokens", "@agriculture/types", "@agriculture/ui"]
};

export default nextConfig;
