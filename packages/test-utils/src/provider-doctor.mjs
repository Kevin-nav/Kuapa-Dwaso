import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchFirebaseAuthorizedDomains,
  findMissingFirebaseAuthDomains,
  parseFirebaseAuthOrigins,
} from "./firebase-auth-domains.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

loadRootEnv();

const mode = parseMode(process.argv.slice(2), process.env.PROVIDER_DOCTOR_MODE);
const checks = [];

checkConvex();
await checkFirebase();
checkSms();
checkNotifications();
checkPayments();
checkR2();
checkUrls();

const errors = checks.filter((check) => check.level === "error");
const warnings = checks.filter((check) => check.level === "warn");

console.log(`Provider doctor mode: ${mode}`);
for (const check of checks) {
  const marker = check.level === "ok" ? "OK" : check.level === "warn" ? "WARN" : "FAIL";
  console.log(`[${marker}] ${check.name}: ${check.message}`);
}

console.log("");
console.log("Webhook URLs to configure:");
console.log(`- Arkesel delivery reports: ${joinUrl(env("NEXT_PUBLIC_API_URL") ?? env("PUBLIC_API_URL") ?? "<api-origin>", "/sms/webhooks/arkesel/delivery")}`);
console.log(`- Notification delivery processor: ${joinUrl(env("NEXT_PUBLIC_API_URL") ?? env("PUBLIC_API_URL") ?? "<api-origin>", "/sms/webhooks/deliveries/process")}`);
console.log(`- Paystack payments: ${joinUrl(env("NEXT_PUBLIC_API_URL") ?? env("PUBLIC_API_URL") ?? "<api-origin>", "/payments/webhooks/paystack")}`);

if (warnings.length > 0) {
  console.log("");
  console.log(`${warnings.length} warning(s) need production review.`);
}
if (errors.length > 0) {
  console.log("");
  console.error(`${errors.length} provider readiness check(s) failed.`);
  process.exitCode = 1;
}

function checkConvex() {
  requireUrl("CONVEX_URL", "Convex URL");
}

async function checkFirebase() {
  requireText("FIREBASE_PROJECT_ID", "Firebase Admin project ID");
  const serviceAccountJsonBase64 = env("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
  if (serviceAccountJsonBase64 === undefined) {
    add(requiredLevel(), "Firebase Admin credentials", "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is required for API token verification.");
  } else {
    try {
      const serviceAccountJson = Buffer.from(serviceAccountJsonBase64, "base64").toString("utf8");
      const parsed = JSON.parse(serviceAccountJson);
      if (typeof parsed.project_id === "string" && parsed.project_id.length > 0) {
        add("ok", "Firebase Admin credentials", "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 decodes and includes project_id.");
      } else {
        add("error", "Firebase Admin credentials", "Decoded FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 must include project_id.");
      }
    } catch {
      add("error", "Firebase Admin credentials", "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 must be base64-encoded valid JSON.");
    }
  }

  for (const key of [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ]) {
    requireText(key, `Firebase browser config ${key}`);
  }
  requireText("CLOUDFLARE_R2_PUBLIC_BUCKET", "Cloudflare R2 public listing-photo bucket");

  const origins = env("FIREBASE_AUTH_ORIGINS");
  if (origins === undefined) {
    add(requiredLevel(), "Firebase authorized domains", "FIREBASE_AUTH_ORIGINS must list the deployed App, Ops, and Admin origins.");
    return;
  }

  let requiredDomains;
  try {
    requiredDomains = parseFirebaseAuthOrigins(origins);
  } catch (error) {
    add("error", "Firebase authorized domains", error instanceof Error ? error.message : "FIREBASE_AUTH_ORIGINS is invalid.");
    return;
  }

  const apiKey = env("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (apiKey === undefined) {
    return;
  }

  try {
    const authorizedDomains = await fetchFirebaseAuthorizedDomains(apiKey);
    const missingDomains = findMissingFirebaseAuthDomains(requiredDomains, authorizedDomains);
    if (missingDomains.length > 0) {
      add("error", "Firebase authorized domains", `Firebase does not authorize: ${missingDomains.join(", ")}`);
    } else {
      add("ok", "Firebase authorized domains", `Firebase authorizes: ${requiredDomains.join(", ")}`);
    }
  } catch (error) {
    add(
      requiredLevel(),
      "Firebase authorized domains",
      error instanceof Error ? error.message : "Could not verify Firebase authorized domains.",
    );
  }
}

function checkSms() {
  const provider = env("SMS_PROVIDER") ?? "mock";
  if (!["mock", "arkesel"].includes(provider)) {
    add("error", "SMS provider", "SMS_PROVIDER must be mock or arkesel.");
    return;
  }
  if (isProviderMode() && provider !== "arkesel") {
    add("error", "SMS provider", "Production/provider mode requires SMS_PROVIDER=arkesel.");
  } else {
    add("ok", "SMS provider", `SMS_PROVIDER=${provider}.`);
  }
  if (provider === "arkesel" || isProviderMode()) {
    requireText("ARKESEL_SMS_API_KEY", "Arkesel API key");
    const sender = env("SMS_FROM_NAME");
    if (sender === undefined || !/^(?=.*[A-Za-z])[A-Za-z0-9]{1,11}$/.test(sender)) {
      add("error", "Arkesel sender ID", "SMS_FROM_NAME must be 1-11 alphanumeric characters with at least one letter.");
    } else {
      add("ok", "Arkesel sender ID", "SMS_FROM_NAME has carrier-safe shape.");
    }
    requireText("ARKESEL_WEBHOOK_SIGNATURE_HEADER", "Arkesel webhook signature header");
    if (env("ARKESEL_WEBHOOK_SIGNATURE_SECRET") === undefined) {
      add("warn", "Arkesel webhook signature secret", "Unsigned Arkesel delivery reports are accepted unless ARKESEL_WEBHOOK_SIGNATURE_SECRET is set; confirm signature details with Arkesel before production.");
    } else {
      add("ok", "Arkesel webhook signature secret", "ARKESEL_WEBHOOK_SIGNATURE_SECRET is configured.");
    }
  }
}

function checkNotifications() {
  if (isProviderMode()) {
    requireText("NOTIFICATION_DELIVERY_SECRET", "Notification delivery secret");
  } else if (env("NOTIFICATION_DELIVERY_SECRET") === undefined) {
    add("warn", "Notification delivery secret", "Local dev may omit NOTIFICATION_DELIVERY_SECRET; production must set it and send x-notification-delivery-secret.");
  } else {
    add("ok", "Notification delivery secret", "NOTIFICATION_DELIVERY_SECRET is configured.");
  }
}

function checkPayments() {
  const provider = env("PAYMENT_PROVIDER") ?? "mock";
  if (!["mock", "paystack"].includes(provider)) {
    add("error", "Payment provider", "PAYMENT_PROVIDER must be mock or paystack.");
    return;
  }
  if (isProviderMode() && provider !== "paystack") {
    add("error", "Payment provider", "Production/provider mode requires PAYMENT_PROVIDER=paystack.");
  } else {
    add("ok", "Payment provider", `PAYMENT_PROVIDER=${provider}.`);
  }
  if (provider === "paystack" || isProviderMode()) {
    requireText("PAYSTACK_PUBLIC_KEY", "Paystack public key");
    requireText("PAYSTACK_SECRET_KEY", "Paystack secret key");
    requireText("PAYSTACK_WEBHOOK_SECRET", "Paystack webhook secret");
  }
}

function checkR2() {
  for (const key of [
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET",
  ]) {
    requireText(key, `Cloudflare R2 ${key}`);
  }
  requireUrl("CLOUDFLARE_R2_PUBLIC_BASE_URL", "Cloudflare R2 public listing-photo URL");
  requirePositiveInteger("R2_PRESIGN_TTL_SECONDS", "R2 signed PUT TTL", 60, 3600);
  requirePositiveInteger("R2_READ_PRESIGN_TTL_SECONDS", "R2 signed GET TTL", 60, 3600);
  requirePositiveInteger("UPLOAD_MAX_SIZE_BYTES", "Upload max size", 1, Number.MAX_SAFE_INTEGER);
}

function checkUrls() {
  requireUrl("PUBLIC_APP_URL", "Public app URL");
  requireUrl("NEXT_PUBLIC_API_URL", "Client API URL");
}

function requireText(key, name) {
  const value = env(key);
  if (value === undefined) {
    add(requiredLevel(), name, `${key} is not set.`);
  } else {
    add("ok", name, `${key} is set.`);
  }
}

function requireUrl(key, name) {
  const value = env(key);
  if (value === undefined) {
    add(requiredLevel(), name, `${key} is not set.`);
    return;
  }
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      add("error", name, `${key} must be an HTTP(S) URL.`);
      return;
    }
    add("ok", name, `${key} is a valid HTTP(S) URL.`);
  } catch {
    add("error", name, `${key} must be a valid URL.`);
  }
}

function requirePositiveInteger(key, name, min, max) {
  const value = env(key);
  if (value === undefined) {
    add(requiredLevel(), name, `${key} is not set.`);
    return;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    add("error", name, `${key} must be an integer between ${min} and ${max}.`);
    return;
  }
  add("ok", name, `${key}=${parsed}.`);
}

function requiredLevel() {
  return isProviderMode() ? "error" : "warn";
}

function add(level, name, message) {
  checks.push({ level, name, message });
}

function env(key) {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  return value.trim();
}

function isProviderMode() {
  return mode === "production" || mode === "provider";
}

function parseMode(args, fallback) {
  const modeArg = args.find((arg) => arg.startsWith("--mode="));
  const value = (modeArg?.slice("--mode=".length) ?? fallback ?? "dev").toLowerCase();
  if (["dev", "mock", "production", "provider"].includes(value)) {
    return value;
  }
  console.error(`Unsupported provider doctor mode "${value}". Use dev, mock, production, or provider.`);
  process.exit(1);
}

function loadRootEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const envPath = resolve(repoRoot, fileName);
    if (!existsSync(envPath)) {
      continue;
    }
    const previousValues = new Map(Object.entries(process.env));
    loadEnvFile(envPath);
    for (const [key, value] of previousValues) {
      process.env[key] = value;
    }
  }
}

function joinUrl(origin, path) {
  if (origin.startsWith("<")) {
    return `${origin}${path}`;
  }
  try {
    return new URL(path, origin).toString();
  } catch {
    return `${origin.replace(/\/$/, "")}${path}`;
  }
}
