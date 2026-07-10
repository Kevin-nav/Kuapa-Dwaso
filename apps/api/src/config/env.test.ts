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
      private_key: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n",
      client_email: "firebase-adminsdk@example.test"
    });
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(serviceAccountJson, "utf8").toString("base64")
    };

    expect(getApiEnvironment().auth.firebaseServiceAccountJson).toBe(serviceAccountJson);
  });

  it("defaults CORS allowed origins to staging domains when API_CORS_ALLOWED_ORIGINS is not set", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production"
    };
    delete process.env.API_CORS_ALLOWED_ORIGINS;
    delete process.env.PUBLIC_APP_URL;

    const env = getApiEnvironment();
    expect(env.cors.allowedOrigins).toEqual([
      "https://staging.kuapadwaso.com",
      "https://app-staging.kuapadwaso.com",
      "https://admin-staging.kuapadwaso.com",
      "https://ops-staging.kuapadwaso.com",
      "https://api-staging.kuapadwaso.com"
    ]);
  });

  it("parses CORS allowed origins from API_CORS_ALLOWED_ORIGINS and appends PUBLIC_APP_URL if defined", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      API_CORS_ALLOWED_ORIGINS: "https://my-origin.test, https://another-origin.test",
      PUBLIC_APP_URL: "https://app-domain.test"
    };

    const env = getApiEnvironment();
    expect(env.cors.allowedOrigins).toEqual([
      "https://my-origin.test",
      "https://another-origin.test",
      "https://app-domain.test"
    ]);
  });
});
