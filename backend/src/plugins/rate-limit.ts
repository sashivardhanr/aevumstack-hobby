interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class LocalRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly maxRequests: number, private readonly windowMs: number) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    for (const [knownKey, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(knownKey);
    }

    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (current.count >= this.maxRequests) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
