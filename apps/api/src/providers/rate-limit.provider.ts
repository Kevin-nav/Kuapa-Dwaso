import { Injectable } from "@nestjs/common";

export type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class InMemoryRateLimitProvider {
  private readonly buckets = new Map<string, RateLimitBucket>();

  check(input: RateLimitInput): RateLimitResult {
    const now = input.now ?? Date.now();
    const windowMs = Math.max(1, input.windowMs);
    const limit = Math.max(1, input.limit);
    const existing = this.buckets.get(input.key);
    const bucket =
      existing === undefined || existing.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : existing;

    bucket.count += 1;
    this.buckets.set(input.key, bucket);

    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt
    };
  }

  reset(key?: string): void {
    if (key === undefined) {
      this.buckets.clear();
      return;
    }
    this.buckets.delete(key);
  }
}
