import { describe, expect, it } from "vitest";

import { clientIp, createMemoryRateLimiter } from "./memory-rate-limit";

describe("memory rate limiter", () => {
  it("allows a burst, then refills over time", () => {
    const limiter = createMemoryRateLimiter({ capacity: 3, refillPerSecond: 1, maxKeys: 10 });
    const t = 1_000_000;
    expect([1, 2, 3].map(() => limiter.take("ip", t).allowed)).toEqual([true, true, true]);
    expect(limiter.take("ip", t)).toEqual({ allowed: false, retryAfter: 1 });
    expect(limiter.take("other", t).allowed).toBe(true);
    expect(limiter.take("ip", t + 1000).allowed).toBe(true);
    expect(limiter.take("ip", t + 1000).allowed).toBe(false);
  });

  it("forgets the least recently seen keys first", () => {
    const limiter = createMemoryRateLimiter({ capacity: 1, refillPerSecond: 0.001, maxKeys: 2 });
    limiter.take("a", 0);
    limiter.take("b", 0);
    limiter.take("a", 0); // a is now the most recent
    limiter.take("c", 0); // evicts b
    expect(limiter.size).toBe(2);
    expect(limiter.take("a", 0).allowed).toBe(false); // still remembered
    expect(limiter.take("b", 0).allowed).toBe(true); // forgotten: a fresh bucket
  });

  it("reads the caller's IP behind the CDN", () => {
    expect(
      clientIp(new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" })),
    ).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
