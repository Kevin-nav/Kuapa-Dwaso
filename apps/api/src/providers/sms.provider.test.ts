import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SmsInviteProvider } from "./sms.provider.js";

describe("SmsInviteProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses the deterministic mock provider by default", async () => {
    delete process.env.SMS_PROVIDER;
    const provider = new SmsInviteProvider();

    await expect(provider.sendInviteSms({ to: "+233500000000", message: "Invite" })).resolves.toMatchObject({
      provider: "mock",
      messageId: expect.stringMatching(/^mock-sms-/)
    });
  });

  it("fails closed when a real SMS provider is requested before one is configured", async () => {
    process.env.SMS_PROVIDER = "real-provider";
    const provider = new SmsInviteProvider();

    await expect(provider.sendSms({ to: "+233500000000", message: "OTP", kind: "otp" })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
