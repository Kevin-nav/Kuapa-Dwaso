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
});
