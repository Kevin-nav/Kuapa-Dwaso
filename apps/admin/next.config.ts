import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));
if (process.env.KUAPA_DWASO_NEXT_ENV_LOADED !== "true") {
  loadEnvConfig(resolve(appDir, "../.."));
}

const nextConfig: NextConfig = {
  transpilePackages: [
    "@kuapa-dwaso/dashboard-ui",
    "@kuapa-dwaso/design-tokens",
    "@kuapa-dwaso/types",
    "@kuapa-dwaso/ui"
  ]
};

export default nextConfig;
