import { afterEach, describe, expect, it } from "vitest";
import { WebPushProvider } from "./web-push.provider.js";

describe("WebPushProvider", () => {
  const originalEnv = { ...process.env };
  afterEach(() => { process.env = { ...originalEnv }; });

  it("uses a network-free mock provider by default", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test", WEB_PUSH_PROVIDER: "mock" };
    const result = await new WebPushProvider().send({ endpoint: "https://push.example.test/id", keys: { p256dh: "key", auth: "auth" }, actionUrl: "/farmer" });
    expect(result).toEqual({ provider: "mock", statusCode: 201 });
  });
});
