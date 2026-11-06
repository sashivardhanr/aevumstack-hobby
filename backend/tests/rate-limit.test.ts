import { describe, expect, it } from 'vitest';
import { LocalRateLimiter } from '../src/plugins/rate-limit.js';

describe('local rate limiter', () => {
  it('limits a fixed window and allows requests again after expiry', () => {
    const limiter = new LocalRateLimiter(2, 1_000);
    expect(limiter.consume('127.0.0.1', 10_000).allowed).toBe(true);
    expect(limiter.consume('127.0.0.1', 10_100).allowed).toBe(true);
    expect(limiter.consume('127.0.0.1', 10_200)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume('127.0.0.1', 11_000).allowed).toBe(true);
  });
});
