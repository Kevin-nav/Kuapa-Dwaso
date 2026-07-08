import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

export const repoRoot = resolve(import.meta.dirname, "../../..");

const modeFiles = {
  development: [".env.development.local", ".env.local", ".env.development", ".env"],
  production: [".env.production.local", ".env.local", ".env.production", ".env"],
  test: [".env.test.local", ".env.test", ".env"]
};

export const nextPublicEnvByApp = {
  app: [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID"
  ],
  admin: [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID"
  ],
  ops: [
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID"
  ],
  www: ["NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_API_URL"]
};

export function loadNextLocalEnv({ appDir, mode = "development" }) {
  const originalEnv = new Map(Object.entries(process.env));
  const protectedKeys = new Set(originalEnv.keys());
  const loadedFiles = [];

  for (const fileName of [".env.local", ".env"]) {
    loadEnvFile(resolve(repoRoot, fileName), {
      override: false,
      protectedKeys,
      loadedFiles
    });
  }

  for (const fileName of envFilesForMode(mode)) {
    loadEnvFile(resolve(appDir, fileName), {
      override: true,
      protectedKeys,
      loadedFiles
    });
  }

  return loadedFiles;
}

export function appEnvStatus(appName, appDir, mode = "development") {
  loadNextLocalEnv({ appDir, mode });

  const keys = nextPublicEnvByApp[appName] ?? [];
  return keys.map((key) => ({
    key,
    present: typeof process.env[key] === "string" && process.env[key].trim().length > 0
  }));
}

export function inferMode(args) {
  const command = args.find((arg) => !arg.startsWith("-")) ?? "dev";
  if (command === "build" || command === "start") {
    return "production";
  }
  if (process.env.NODE_ENV === "test") {
    return "test";
  }
  return "development";
}

function envFilesForMode(mode) {
  return modeFiles[mode] ?? modeFiles.development;
}

function loadEnvFile(filePath, { override, protectedKeys, loadedFiles }) {
  if (!existsSync(filePath)) {
    return;
  }

  const parsed = parseEnv(readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (protectedKeys.has(key)) {
      continue;
    }
    if (!override && process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
  loadedFiles.push(filePath);
}
