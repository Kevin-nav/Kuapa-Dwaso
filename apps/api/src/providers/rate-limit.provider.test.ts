import { describe, expect, it } from "vitest";
import { InMemoryRateLimitProvider } from "./rate-limit.provider.js";

describe("InMemoryRateLimitProvider", () => {
  it("allows requests until the limit is reached", () => {
    const provider = new InMemoryRateLimitProvider();

    expect(provider.check({ key: "invite:user-1", limit: 2, windowMs: 1_000, now: 1_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
      resetAt: 2_000
    });
    expect(provider.check({ key: "invite:user-1", limit: 2, windowMs: 1_000, now: 1_100 })).toMatchObject({
      allowed: true,
      remaining: 0,
      resetAt: 2_000
    });
    expect(provider.check({ key: "invite:user-1", limit: 2, windowMs: 1_000, now: 1_200 })).toMatchObject({
      allowed: false,
      remaining: 0,
      resetAt: 2_000
    });
  });

  it("resets buckets after the window expires", () => {
    const provider = new InMemoryRateLimitProvider();

    provider.check({ key: "upload:user-1", limit: 1, windowMs: 1_000, now: 1_000 });

    expect(provider.check({ key: "upload:user-1", limit: 1, windowMs: 1_000, now: 2_000 })).toMatchObject({
      allowed: true,
      remaining: 0,
      resetAt: 3_000
    });
  });
});
