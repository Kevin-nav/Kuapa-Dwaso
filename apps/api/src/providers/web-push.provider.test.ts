import { afterEach, describe, expect, it } from "vitest";
import { WebPushProvider } from "./web-push.provider.js";

describe("WebPushProvider", () => {
  const originalEnv = { ...process.env };
  afterEach(() => { process.env = { ...originalEnv }; });

  it("uses a network-free mock provider by default", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test", WEB_PUSH_PROVIDER: "mock" };
    const result = await new WebPushProvider().send({ endpoint: "https://fcm.googleapis.com/fcm/send/id", keys: { p256dh: "a".repeat(64), auth: "b".repeat(16) }, actionUrl: "/farmer" });
    expect(result).toEqual({ provider: "mock", statusCode: 201 });
  });

  it("rejects arbitrary HTTPS endpoints before mock or VAPID delivery", async () => {
    process.env = { ...originalEnv, NODE_ENV: "test", WEB_PUSH_PROVIDER: "mock" };
    await expect(new WebPushProvider().send({ endpoint: "https://attacker.example/push", keys: { p256dh: "a".repeat(64), auth: "b".repeat(16) }, actionUrl: "/farmer" })).rejects.toThrow("approved browser push service");
  });
});
