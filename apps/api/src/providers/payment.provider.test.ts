import { createHmac } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  assertPaystackWebhookSignature,
  normalizePaystackTransactionStatus,
  normalizePaystackWebhookEvent,
} from "./payment.provider.js";

describe("payment.provider", () => {
  it("normalizes Paystack transaction statuses to platform statuses", () => {
    expect(normalizePaystackTransactionStatus("success")).toBe("successful");
    expect(normalizePaystackTransactionStatus("ongoing")).toBe("processing");
    expect(normalizePaystackTransactionStatus("processing")).toBe("processing");
    expect(normalizePaystackTransactionStatus("queued")).toBe("processing");
    expect(normalizePaystackTransactionStatus("abandoned")).toBe("abandoned");
    expect(normalizePaystackTransactionStatus("failed")).toBe("failed");
    expect(normalizePaystackTransactionStatus("reversed")).toBe("reversed");
    expect(normalizePaystackTransactionStatus("unknown")).toBe("manual_review");
  });

  it("verifies Paystack webhook signatures with HMAC-SHA512", () => {
    const rawBody = JSON.stringify({
      event: "charge.success",
      data: { id: 123, reference: "KD-PAYSTACK-1", status: "success" },
    });
    const secret = "paystack-test-secret";
    const signature = createHmac("sha512", secret).update(rawBody).digest("hex");

    expect(() =>
      assertPaystackWebhookSignature({
        rawBody,
        signatureHeader: signature,
        secret,
      }),
    ).not.toThrow();
    expect(() =>
      assertPaystackWebhookSignature({
        rawBody,
        signatureHeader: "bad",
        secret,
      }),
    ).toThrow(UnauthorizedException);
  });

  it("normalizes Paystack webhook payloads without leaking provider status into product code", () => {
    const event = normalizePaystackWebhookEvent({
      event: "charge.success",
      data: {
        id: 321,
        reference: "KD-PAYSTACK-2",
        amount: 12345,
        currency: "GHS",
        status: "success",
        gateway_response: "Approved",
      },
    });

    expect(event).toMatchObject({
      provider: "paystack",
      providerEventId: "charge.success:321",
      eventType: "charge.success",
      reference: "KD-PAYSTACK-2",
      amount: 123.45,
      currency: "GHS",
      status: "successful",
      providerStatus: "success",
      providerMessage: "Approved",
    });
  });
});
