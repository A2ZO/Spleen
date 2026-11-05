/*
 * In-memory token bucket per key (an IP address), for cheap public reads such as the instant
 * search: no database write per keystroke. Approximate by design: each server instance keeps
 * its own buckets, and a restart forgets them. The Postgres limiter (`./rate-limit`) stays for
 * what must hold across instances (MusicBrainz imports, sign-in emails).
 */

export interface MemoryRateLimitRule {
  /** Burst size: requests allowed at once. */
  capacity: number;
  /** Tokens given back per second. */
  refillPerSecond: number;
  /** Keys kept at most; the least recently seen go first. */
  maxKeys: number;
}

export interface MemoryRateLimiter {
  take(key: string, now?: number): { allowed: boolean; retryAfter: number | null };
  readonly size: number;
}

export function createMemoryRateLimiter(rule: MemoryRateLimitRule): MemoryRateLimiter {
  // A Map keeps insertion order: re-inserting on each hit makes the first key the oldest.
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    take(key, now = Date.now()) {
      const bucket = buckets.get(key);
      const tokens = bucket
        ? Math.min(rule.capacity, bucket.tokens + ((now - bucket.at) / 1000) * rule.refillPerSecond)
        : rule.capacity;
      buckets.delete(key);
      if (buckets.size >= rule.maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      if (tokens < 1) {
        buckets.set(key, { tokens, at: now });
        return { allowed: false, retryAfter: Math.ceil((1 - tokens) / rule.refillPerSecond) };
      }
      buckets.set(key, { tokens: tokens - 1, at: now });
      return { allowed: true, retryAfter: null };
    },
    get size() {
      return buckets.size;
    },
  };
}

/**
 * The caller's IP address behind the CDN: Cloudflare's header, else the first
 * `X-Forwarded-For` hop, else a shared "unknown" bucket.
 */
export function clientIp(headers: Headers): string {
  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
