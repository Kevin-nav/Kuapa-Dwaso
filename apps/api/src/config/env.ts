import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ApiEnvironment = {
  nodeEnv: string;
  port: number;
  auth: {
    convexUrl?: string;
    firebaseProjectId?: string;
    firebaseServiceAccountJson?: string;
    disabled: boolean;
  };
  publicAppUrl?: string;
  email: {
    resendApiKey?: string;
    fromEmail?: string;
  };
  sms: {
    mock: boolean;
    fromName?: string;
  };
  uploads: {
    r2AccountId?: string;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
    r2Bucket?: string;
    r2PublicBaseUrl?: string;
    presignTtlSeconds: number;
    maxSizeBytes: number;
  };
  rateLimit: {
    windowMs: number;
    inviteSendMax: number;
    uploadPresignMax: number;
  };
};

const defaultPort = 4000;
let rootEnvLoaded = false;

function loadRootEnvFiles(): void {
  if (rootEnvLoaded || process.env.NODE_ENV === "production") {
    return;
  }
  rootEnvLoaded = true;

  const configDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(configDir, "../../../..");
  for (const fileName of [".env.local", ".env"]) {
    const envPath = resolve(repoRoot, fileName);
    if (existsSync(envPath)) {
      const existingValues = new Map(Object.entries(process.env));
      loadEnvFile(envPath);
      for (const [key, value] of existingValues) {
        process.env[key] = value;
      }
    }
  }
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return defaultPort;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultPort;
}

export function getApiEnvironment(): ApiEnvironment {
  loadRootEnvFiles();
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const auth: ApiEnvironment["auth"] = {
    disabled: process.env.API_AUTH_DISABLED === "true" && nodeEnv !== "production"
  };

  if (process.env.FIREBASE_PROJECT_ID !== undefined) {
    auth.firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON !== undefined) {
    auth.firebaseServiceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }

  if (process.env.CONVEX_URL !== undefined) {
    auth.convexUrl = process.env.CONVEX_URL;
  }

  const email: ApiEnvironment["email"] = {};
  if (process.env.RESEND_API_KEY !== undefined) {
    email.resendApiKey = process.env.RESEND_API_KEY;
  }
  if (process.env.RESEND_FROM_EMAIL !== undefined) {
    email.fromEmail = process.env.RESEND_FROM_EMAIL;
  }

  const sms: ApiEnvironment["sms"] = {
    mock: process.env.SMS_PROVIDER === undefined || process.env.SMS_PROVIDER === "mock"
  };
  if (process.env.SMS_FROM_NAME !== undefined) {
    sms.fromName = process.env.SMS_FROM_NAME;
  }

  const uploads: ApiEnvironment["uploads"] = {
    presignTtlSeconds: parsePositiveInteger(process.env.R2_PRESIGN_TTL_SECONDS, 900),
    maxSizeBytes: parsePositiveInteger(process.env.UPLOAD_MAX_SIZE_BYTES, 8 * 1024 * 1024)
  };
  if (process.env.CLOUDFLARE_R2_ACCOUNT_ID !== undefined) {
    uploads.r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  }
  if (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID !== undefined) {
    uploads.r2AccessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  }
  if (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY !== undefined) {
    uploads.r2SecretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  }
  if (process.env.CLOUDFLARE_R2_BUCKET !== undefined) {
    uploads.r2Bucket = process.env.CLOUDFLARE_R2_BUCKET;
  }
  if (process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL !== undefined) {
    uploads.r2PublicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL;
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL;

  const environment: ApiEnvironment = {
    nodeEnv,
    port: parsePort(process.env.PORT),
    auth,
    email,
    sms,
    uploads,
    rateLimit: {
      windowMs: parsePositiveInteger(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      inviteSendMax: parsePositiveInteger(process.env.API_RATE_LIMIT_INVITE_SEND_MAX, 20),
      uploadPresignMax: parsePositiveInteger(process.env.API_RATE_LIMIT_UPLOAD_PRESIGN_MAX, 60)
    }
  };
  if (publicAppUrl !== undefined) {
    environment.publicAppUrl = publicAppUrl;
  }
  return environment;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
