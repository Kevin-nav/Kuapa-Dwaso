import { createHmac } from "node:crypto";
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertArkeselWebhookSignature,
  normalizeArkeselDeliveryReport,
  SmsInviteProvider,
} from "./sms.provider.js";

describe("SmsInviteProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the deterministic mock provider by default", async () => {
    delete process.env.SMS_PROVIDER;
    const provider = new SmsInviteProvider();

    await expect(provider.sendInviteSms({ to: "050 000 0000", message: "Invite" })).resolves.toMatchObject({
      provider: "mock",
      messageId: expect.stringMatching(/^mock-sms-/),
      providerMessageId: expect.stringMatching(/^mock-sms-/),
      recipients: ["+233500000000"],
      status: "sent",
      creditsUsed: 1,
    });
  });

  it("fails closed when an unsupported SMS provider is requested", async () => {
    process.env.SMS_PROVIDER = "real-provider";
    const provider = new SmsInviteProvider();

    await expect(provider.sendSms({ to: "+233500000000", message: "OTP", kind: "otp" })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("posts rendered SMS text to the Arkesel V2 JSON endpoint", async () => {
    process.env.SMS_PROVIDER = "arkesel";
    process.env.ARKESEL_SMS_API_KEY = "ark_test";
    process.env.SMS_FROM_NAME = "KuapaDwaso";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          data: [
            { recipient: "0500000000", id: "msg_123", credits_used: 1 },
            { recipient: "+233240000000", id: "msg_456", credits_used: 1 },
          ],
        }),
      }),
    );
    const provider = new SmsInviteProvider();

    await expect(
      provider.sendSms({
        to: ["0500000000", "+233240000000"],
        message: "Receipt REC-1 is ready",
        kind: "notification",
      }),
    ).resolves.toMatchObject({
      provider: "arkesel",
      messageId: "msg_123",
      providerMessageId: "msg_123",
      recipients: ["+233500000000", "+233240000000"],
      status: "sent",
      creditsUsed: 2,
      recipientMessageIds: {
        "+233500000000": "msg_123",
        "+233240000000": "msg_456",
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://sms.arkesel.com/api/v2/sms/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "api-key": "ark_test",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          sender: "KuapaDwaso",
          message: "Receipt REC-1 is ready",
          recipients: ["+233500000000", "+233240000000"],
        }),
      }),
    );
  });

  it("supports the legacy single-receipt response shape", async () => {
    process.env.SMS_PROVIDER = "arkesel";
    process.env.ARKESEL_SMS_API_KEY = "ark_test";
    process.env.SMS_FROM_NAME = "KuapaDwaso";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: "success",
          data: { id: "msg_legacy", credits_used: 2 },
        }),
      }),
    );

    const provider = new SmsInviteProvider();

    await expect(
      provider.sendSms({
        to: ["0500000000", "+233240000000"],
        message: "Receipt REC-1 is ready",
      }),
    ).resolves.toMatchObject({
      recipients: ["+233500000000", "+233240000000"],
      recipientMessageIds: {
        "+233500000000": "msg_legacy",
        "+233240000000": "msg_legacy",
      },
      creditsUsed: 2,
    });
  });

  it("validates Arkesel sender IDs before sending", async () => {
    process.env.SMS_PROVIDER = "arkesel";
    process.env.ARKESEL_SMS_API_KEY = "ark_test";
    process.env.SMS_FROM_NAME = "Kuapa-Dwaso!";
    const provider = new SmsInviteProvider();

    await expect(provider.sendSms({ to: "+233500000000", message: "Invite" })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("surfaces Arkesel 4xx failures as nonretryable provider failures", async () => {
    process.env.SMS_PROVIDER = "arkesel";
    process.env.ARKESEL_SMS_API_KEY = "ark_test";
    process.env.SMS_FROM_NAME = "KuapaDwaso";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ code: "422", message: "Validation Errors" }),
      }),
    );
    const provider = new SmsInviteProvider();

    await expect(provider.sendSms({ to: "+233500000000", message: "Invite" })).rejects.toMatchObject({
      response: expect.objectContaining({
        errorClass: "nonretryable",
        rawCode: "422",
      }),
    });
  });

  it("rejects invalid phone numbers before provider dispatch", async () => {
    const provider = new SmsInviteProvider();

    await expect(provider.sendSms({ to: "12345", message: "Invite" })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("Arkesel delivery reports", () => {
  it("normalizes status, recipient, network, timestamp, and credits", () => {
    expect(
      normalizeArkeselDeliveryReport({
        message_id: "msg_123",
        status: "delivered",
        recipient: "0500000000",
        network: "MTN",
        timestamp: "2026-03-31T14:32:01Z",
        credits_charged: 1,
      }),
    ).toMatchObject({
      provider: "arkesel",
      providerMessageId: "msg_123",
      recipient: "+233500000000",
      status: "delivered",
      network: "MTN",
      providerTimestamp: Date.parse("2026-03-31T14:32:01Z"),
      creditsCharged: 1,
    });
  });

  it("fails malformed delivery reports closed", () => {
    expect(() => normalizeArkeselDeliveryReport({ status: "delivered" })).toThrow(BadRequestException);
  });

  it("allows unsigned webhooks when no signing secret is configured", () => {
    expect(() =>
      assertArkeselWebhookSignature({
        payload: { message_id: "msg_123" },
        signatureHeader: undefined,
        secret: undefined,
      }),
    ).not.toThrow();
  });

  it("fails closed when signing is configured and the signature is missing or invalid", () => {
    expect(() =>
      assertArkeselWebhookSignature({
        payload: { message_id: "msg_123" },
        signatureHeader: undefined,
        secret: "secret",
      }),
    ).toThrow(UnauthorizedException);
    expect(() =>
      assertArkeselWebhookSignature({
        payload: { message_id: "msg_123" },
        signatureHeader: "bad",
        secret: "secret",
      }),
    ).toThrow(UnauthorizedException);
  });

  it("accepts the configured HMAC-SHA256 signature format", () => {
    const payload = { message_id: "msg_123" };
    const signature = createHmac("sha256", "secret").update(JSON.stringify(payload)).digest("hex");

    expect(() =>
      assertArkeselWebhookSignature({
        payload,
        signatureHeader: `sha256=${signature}`,
        secret: "secret",
      }),
    ).not.toThrow();
  });
});
