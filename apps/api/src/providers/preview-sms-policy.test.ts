import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { PreviewSmsPolicy } from "./preview-sms-policy.js";

const regularWednesday = Date.parse("2026-09-16T10:15:00Z");
const highCapacityThursday = Date.parse("2026-09-17T10:15:00Z");

function configuration() {
  return {
    enabled: true,
    recipientAllowlist: ["+233240000001", "+233240000002"],
    hourlySegmentLimit: 2,
    highCapacityUtcDates: ["2026-09-17"],
    highCapacityHourlySegmentLimit: 5,
  } as const;
}

describe("PreviewSmsPolicy", () => {
  it("is inert when shared preview access is disabled", () => {
    const policy = new PreviewSmsPolicy();

    expect(() =>
      policy.assertAllowedAndReserve({
        configuration: { ...configuration(), enabled: false },
        recipients: ["+233501234567"],
        segmentsPerRecipient: 99,
        messageKind: "promotional",
        now: regularWednesday,
      }),
    ).not.toThrow();
  });

  it("fails closed when no team-controlled recipients are configured", () => {
    const policy = new PreviewSmsPolicy();

    expect(() =>
      policy.assertAllowedAndReserve({
        configuration: { ...configuration(), recipientAllowlist: [] },
        recipients: ["+233240000001"],
        segmentsPerRecipient: 1,
        messageKind: "transactional",
        now: regularWednesday,
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it("blocks recipients outside the team allowlist and promotional messages", () => {
    const policy = new PreviewSmsPolicy();

    expect(() =>
      policy.assertAllowedAndReserve({
        configuration: configuration(),
        recipients: ["+233501234567"],
        segmentsPerRecipient: 1,
        messageKind: "transactional",
        now: regularWednesday,
      }),
    ).toThrow(ForbiddenException);
    expect(() =>
      policy.assertAllowedAndReserve({
        configuration: configuration(),
        recipients: ["+233240000001"],
        segmentsPerRecipient: 1,
        messageKind: "promotional",
        now: regularWednesday,
      }),
    ).toThrow(ForbiddenException);
  });

  it("counts SMS segments per recipient and resets on the next UTC hour", () => {
    const policy = new PreviewSmsPolicy();
    const input = {
      configuration: configuration(),
      recipients: ["+233240000001"],
      segmentsPerRecipient: 1,
      messageKind: "transactional",
      now: regularWednesday,
    } as const;

    policy.assertAllowedAndReserve(input);
    policy.assertAllowedAndReserve(input);
    expect(() => policy.assertAllowedAndReserve(input)).toThrow(HttpException);
    try {
      policy.assertAllowedAndReserve(input);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(() =>
      policy.assertAllowedAndReserve({
        ...input,
        now: regularWednesday + 60 * 60 * 1000,
      }),
    ).not.toThrow();
  });

  it("uses the larger configured limit on 17 September 2026 UTC", () => {
    const policy = new PreviewSmsPolicy();
    const input = {
      configuration: configuration(),
      recipients: ["+233240000001"],
      segmentsPerRecipient: 1,
      messageKind: "transactional",
      now: highCapacityThursday,
    } as const;

    for (let index = 0; index < 5; index += 1) {
      policy.assertAllowedAndReserve(input);
    }
    expect(() => policy.assertAllowedAndReserve(input)).toThrow(HttpException);
  });
});
