import { afterEach, describe, expect, it } from "vitest";
import { getApiEnvironment } from "./env.js";

describe("getApiEnvironment", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("decodes Firebase Admin service account JSON from base64", () => {
    const serviceAccountJson = JSON.stringify({
      project_id: "kuapa-test",
      private_key:
        "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n",
      client_email: "firebase-adminsdk@example.test",
    });
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(
        serviceAccountJson,
        "utf8",
      ).toString("base64"),
    };

    expect(getApiEnvironment().auth.firebaseServiceAccountJson).toBe(
      serviceAccountJson,
    );
  });

  it("defaults CORS allowed origins to the deployed domains when API_CORS_ALLOWED_ORIGINS is not set", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
    };
    delete process.env.API_CORS_ALLOWED_ORIGINS;
    delete process.env.PUBLIC_APP_URL;

    const env = getApiEnvironment();
    expect(env.cors.allowedOrigins).toEqual([
      "https://kuapadwaso.com",
      "https://app.kuapadwaso.com",
      "https://admin.kuapadwaso.com",
      "https://ops.kuapadwaso.com",
      "https://api.kuapadwaso.com",
    ]);
  });

  it("parses CORS allowed origins from API_CORS_ALLOWED_ORIGINS and appends PUBLIC_APP_URL if defined", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      API_CORS_ALLOWED_ORIGINS:
        "https://my-origin.test, https://another-origin.test",
      PUBLIC_APP_URL: "https://app-domain.test",
    };

    const env = getApiEnvironment();
    expect(env.cors.allowedOrigins).toEqual([
      "https://my-origin.test",
      "https://another-origin.test",
      "https://app-domain.test",
    ]);
  });

  it("keeps preview Firebase UID mappings and cutoff in server configuration", () => {
    const cutoffUtc = new Date(Date.now() + 60_000).toISOString();
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      PREVIEW_ACCESS_ENABLED: "true",
      PREVIEW_ACCESS_CUTOFF_UTC: cutoffUtc,
      PREVIEW_ACCESS_FARMER_FIREBASE_UID: "farmer-uid",
      PREVIEW_ACCESS_BUYER_FIREBASE_UID: "buyer-uid",
      PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID: "transporter-uid",
      PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID: "operations-uid",
      API_RATE_LIMIT_PREVIEW_SESSION_MAX: "45",
      PREVIEW_SMS_RECIPIENT_ALLOWLIST: "0240000001, +233240000002,0240000001",
      PREVIEW_SMS_HOURLY_SEGMENT_LIMIT: "8",
      PREVIEW_SMS_HIGH_CAPACITY_UTC_DATES: "2026-09-17",
      PREVIEW_SMS_HIGH_CAPACITY_HOURLY_SEGMENT_LIMIT: "80",
    };

    expect(getApiEnvironment()).toMatchObject({
      previewAccess: {
        enabled: true,
        cutoffUtc,
        firebaseUids: {
          farmer: "farmer-uid",
          buyer: "buyer-uid",
          transporter: "transporter-uid",
          warehouse_agent: "operations-uid",
        },
      },
      rateLimit: {
        previewSessionMax: 45,
      },
      sms: {
        previewPolicy: {
          enabled: true,
          recipientAllowlist: ["0240000001", "+233240000002"],
          hourlySegmentLimit: 8,
          highCapacityUtcDates: ["2026-09-17"],
          highCapacityHourlySegmentLimit: 80,
        },
      },
    });
  });
});
