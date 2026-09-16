import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const previewAccessRoles = [
  "farmer",
  "buyer",
  "transporter",
  "warehouse_agent",
] as const;
export type PreviewAccessRole = (typeof previewAccessRoles)[number];

export type ApiEnvironment = {
  nodeEnv: string;
  port: number;
  auth: {
    convexUrl?: string;
    firebaseProjectId?: string;
    firebaseServiceAccountJson?: string;
    disabled: boolean;
  };
  previewAccess: {
    enabled: boolean;
    cutoffUtc?: string;
    firebaseUids: Partial<Record<PreviewAccessRole, string>>;
  };
  publicAppUrl?: string;
  productAppUrl?: string;
  cors: {
    allowedOrigins: string[];
  };
  email: {
    resendApiKey?: string;
    fromEmail?: string;
  };
  sms: {
    provider: "mock" | "arkesel";
    unsupportedProvider?: string;
    fromName?: string;
    arkeselApiKey?: string;
    webhookSignatureSecret?: string;
    webhookSignatureHeader: string;
    previewPolicy: {
      enabled: boolean;
      recipientAllowlist: string[];
      hourlySegmentLimit: number;
      highCapacityUtcDates: string[];
      highCapacityHourlySegmentLimit: number;
    };
  };
  payments: {
    provider: "mock" | "paystack";
    unsupportedProvider?: string;
    paystackSecretKey?: string;
    paystackPublicKey?: string;
    webhookSecret?: string;
    serviceSecret?: string;
  };
  uploads: {
    r2AccountId?: string;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
    r2Bucket?: string;
    r2PublicBucket?: string;
    r2PublicBaseUrl?: string;
    presignTtlSeconds: number;
    readPresignTtlSeconds: number;
    maxSizeBytes: number;
  };
  rateLimit: {
    windowMs: number;
    inviteSendMax: number;
    uploadPresignMax: number;
    previewSessionMax: number;
  };
  notifications: {
    deliverySecret?: string;
    webPushProvider: "mock" | "vapid";
    vapidSubject?: string;
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
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
    disabled:
      process.env.API_AUTH_DISABLED === "true" && nodeEnv !== "production",
  };

  if (process.env.FIREBASE_PROJECT_ID !== undefined) {
    auth.firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 !== undefined) {
    auth.firebaseServiceAccountJson = decodeBase64Text(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64,
    );
  }

  if (process.env.CONVEX_URL !== undefined) {
    auth.convexUrl = process.env.CONVEX_URL;
  }

  const previewAccess: ApiEnvironment["previewAccess"] = {
    enabled: process.env.PREVIEW_ACCESS_ENABLED === "true",
    firebaseUids: {},
  };
  if (process.env.PREVIEW_ACCESS_CUTOFF_UTC !== undefined) {
    previewAccess.cutoffUtc = process.env.PREVIEW_ACCESS_CUTOFF_UTC;
  }
  const previewFirebaseUidEnvironmentKeys: Record<PreviewAccessRole, string> = {
    farmer: "PREVIEW_ACCESS_FARMER_FIREBASE_UID",
    buyer: "PREVIEW_ACCESS_BUYER_FIREBASE_UID",
    transporter: "PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID",
    warehouse_agent: "PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID",
  };
  for (const role of previewAccessRoles) {
    const uid = process.env[previewFirebaseUidEnvironmentKeys[role]];
    if (uid !== undefined) {
      previewAccess.firebaseUids[role] = uid;
    }
  }

  const email: ApiEnvironment["email"] = {};
  if (process.env.RESEND_API_KEY !== undefined) {
    email.resendApiKey = process.env.RESEND_API_KEY;
  }
  if (process.env.RESEND_FROM_EMAIL !== undefined) {
    email.fromEmail = process.env.RESEND_FROM_EMAIL;
  }

  const requestedSmsProvider = process.env.SMS_PROVIDER ?? "mock";
  const smsProvider = requestedSmsProvider === "arkesel" ? "arkesel" : "mock";
  const previewHourlySegmentLimit = parsePositiveInteger(
    process.env.PREVIEW_SMS_HOURLY_SEGMENT_LIMIT,
    12,
  );
  const sms: ApiEnvironment["sms"] = {
    provider: smsProvider,
    webhookSignatureHeader:
      process.env.ARKESEL_WEBHOOK_SIGNATURE_HEADER ?? "x-arkesel-signature",
    previewPolicy: {
      enabled: previewAccess.enabled,
      recipientAllowlist: parseCommaSeparatedValues(
        process.env.PREVIEW_SMS_RECIPIENT_ALLOWLIST,
      ),
      hourlySegmentLimit: previewHourlySegmentLimit,
      highCapacityUtcDates: parseCommaSeparatedValues(
        process.env.PREVIEW_SMS_HIGH_CAPACITY_UTC_DATES,
      ),
      highCapacityHourlySegmentLimit: Math.max(
        previewHourlySegmentLimit,
        parsePositiveInteger(
          process.env.PREVIEW_SMS_HIGH_CAPACITY_HOURLY_SEGMENT_LIMIT,
          120,
        ),
      ),
    },
  };
  if (requestedSmsProvider !== "mock" && requestedSmsProvider !== "arkesel") {
    sms.unsupportedProvider = requestedSmsProvider;
  }
  if (process.env.SMS_FROM_NAME !== undefined) {
    sms.fromName = process.env.SMS_FROM_NAME;
  }
  if (process.env.ARKESEL_SMS_API_KEY !== undefined) {
    sms.arkeselApiKey = process.env.ARKESEL_SMS_API_KEY;
  }
  if (process.env.ARKESEL_WEBHOOK_SIGNATURE_SECRET !== undefined) {
    sms.webhookSignatureSecret = process.env.ARKESEL_WEBHOOK_SIGNATURE_SECRET;
  }

  const requestedPaymentProvider = process.env.PAYMENT_PROVIDER ?? "mock";
  const paymentProvider =
    requestedPaymentProvider === "paystack" ? "paystack" : "mock";
  const payments: ApiEnvironment["payments"] = {
    provider: paymentProvider,
  };
  if (
    requestedPaymentProvider !== "mock" &&
    requestedPaymentProvider !== "paystack"
  ) {
    payments.unsupportedProvider = requestedPaymentProvider;
  }
  if (process.env.PAYSTACK_SECRET_KEY !== undefined) {
    payments.paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  }
  if (process.env.PAYSTACK_PUBLIC_KEY !== undefined) {
    payments.paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
  }
  if (process.env.PAYSTACK_WEBHOOK_SECRET !== undefined) {
    payments.webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  }
  if (process.env.PAYMENT_PROVIDER_SERVICE_SECRET !== undefined) {
    payments.serviceSecret = process.env.PAYMENT_PROVIDER_SERVICE_SECRET;
  }

  const uploads: ApiEnvironment["uploads"] = {
    presignTtlSeconds: parsePositiveInteger(
      process.env.R2_PRESIGN_TTL_SECONDS,
      900,
    ),
    readPresignTtlSeconds: parsePositiveInteger(
      process.env.R2_READ_PRESIGN_TTL_SECONDS,
      300,
    ),
    maxSizeBytes: parsePositiveInteger(
      process.env.UPLOAD_MAX_SIZE_BYTES,
      8 * 1024 * 1024,
    ),
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
  if (process.env.CLOUDFLARE_R2_PUBLIC_BUCKET !== undefined) {
    uploads.r2PublicBucket = process.env.CLOUDFLARE_R2_PUBLIC_BUCKET;
  }
  if (process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL !== undefined) {
    uploads.r2PublicBaseUrl = process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL.replace(
      /\/$/,
      "",
    );
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL;
  const productAppUrl = process.env.PRODUCT_APP_URL;
  const requestedWebPushProvider = process.env.WEB_PUSH_PROVIDER ?? "mock";
  const notifications: ApiEnvironment["notifications"] = {
    webPushProvider: requestedWebPushProvider === "vapid" ? "vapid" : "mock",
  };
  if (process.env.NOTIFICATION_DELIVERY_SECRET !== undefined) {
    notifications.deliverySecret = process.env.NOTIFICATION_DELIVERY_SECRET;
  }
  if (process.env.WEB_PUSH_VAPID_SUBJECT !== undefined)
    notifications.vapidSubject = process.env.WEB_PUSH_VAPID_SUBJECT;
  if (process.env.WEB_PUSH_VAPID_PUBLIC_KEY !== undefined)
    notifications.vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  if (process.env.WEB_PUSH_VAPID_PRIVATE_KEY !== undefined)
    notifications.vapidPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

  const rawAllowedOrigins = process.env.API_CORS_ALLOWED_ORIGINS;
  const allowedOrigins = rawAllowedOrigins
    ? rawAllowedOrigins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : [
        "https://kuapadwaso.com",
        "https://app.kuapadwaso.com",
        "https://admin.kuapadwaso.com",
        "https://ops.kuapadwaso.com",
        "https://api.kuapadwaso.com",
      ];

  if (publicAppUrl && !allowedOrigins.includes(publicAppUrl)) {
    allowedOrigins.push(publicAppUrl);
  }
  if (productAppUrl && !allowedOrigins.includes(productAppUrl)) {
    allowedOrigins.push(productAppUrl);
  }

  const environment: ApiEnvironment = {
    nodeEnv,
    port: parsePort(process.env.PORT),
    auth,
    previewAccess,
    cors: {
      allowedOrigins,
    },
    email,
    sms,
    payments,
    uploads,
    rateLimit: {
      windowMs: parsePositiveInteger(
        process.env.API_RATE_LIMIT_WINDOW_MS,
        15 * 60 * 1000,
      ),
      inviteSendMax: parsePositiveInteger(
        process.env.API_RATE_LIMIT_INVITE_SEND_MAX,
        20,
      ),
      uploadPresignMax: parsePositiveInteger(
        process.env.API_RATE_LIMIT_UPLOAD_PRESIGN_MAX,
        60,
      ),
      previewSessionMax: parsePositiveInteger(
        process.env.API_RATE_LIMIT_PREVIEW_SESSION_MAX,
        30,
      ),
    },
    notifications,
  };
  if (publicAppUrl !== undefined) {
    environment.publicAppUrl = publicAppUrl;
  }
  if (productAppUrl !== undefined) {
    environment.productAppUrl = productAppUrl;
  }
  return environment;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCommaSeparatedValues(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function decodeBase64Text(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}
