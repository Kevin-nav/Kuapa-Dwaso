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
    "@kuapa-dwaso/design-tokens",
    "@kuapa-dwaso/types",
    "@kuapa-dwaso/ui",
    "@kuapa-dwaso/utils",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.kuapadwaso.com",
        pathname: "/produce/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self'" },
        ],
      },
      {
        source: "/pwa/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/auth-bg-v1.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
