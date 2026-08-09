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
    "@kuapa-dwaso/config",
    "@kuapa-dwaso/design-tokens",
    "@kuapa-dwaso/ui",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.kuapadwaso.com" },
      { protocol: "https", hostname: "images.kuapadwaso.com" },
    ],
  },
};

export default nextConfig;
