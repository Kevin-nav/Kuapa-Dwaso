import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
loadEnvConfig(resolve(appDir, "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@kuapa-dwaso/design-tokens", "@kuapa-dwaso/ui"]
};

export default nextConfig;
