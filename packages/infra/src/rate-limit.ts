import { sql, type Db } from "@spleen/db";

export interface RateLimitRule {
  /** Window length in seconds. */
  window: number;
  max: number;
}

/**
 * Fixed-window counter in the `rate_limits` table, checked and incremented in one atomic
 * statement (safe under concurrent requests and through Neon's transaction pooler).
 */
export async function consumeRateLimit(
  db: Db,
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const window = sql`make_interval(secs => ${rule.window})`;
  const result = await db.execute(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start <= now() - ${window}
        then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start <= now() - ${window}
        then now() else rate_limits.window_start end
    returning count,
      ceil(extract(epoch from (window_start + ${window} - now())))::int as retry_after
  `);
  const row = rowsOf(result)[0] as { count: number; retry_after: number };
  const allowed = Number(row.count) <= rule.max;
  return { allowed, retryAfter: allowed ? null : Math.max(1, Number(row.retry_after)) };
}

/**
 * Global request gate (e.g. MusicBrainz, 1 request/s for the whole site): reserves the next
 * free slot in `rate_limits.next_allowed_at` in one atomic statement and returns how long the
 * caller must wait before sending its request. Works across serverless instances and through
 * Neon's transaction pooler (no session state, no advisory lock).
 * Returns null without reserving anything when the queue is longer than `maxWaitMs`.
 */
export async function reserveSlot(
  db: Db,
  key: string,
  rule: { intervalMs: number; maxWaitMs: number },
): Promise<number | null> {
  const interval = sql`make_interval(secs => ${rule.intervalMs / 1000})`;
  const result = await db.execute(sql`
    insert into rate_limits (key, next_allowed_at) values (${key}, now() + ${interval})
    on conflict (key) do update set
      next_allowed_at = greatest(now(), coalesce(rate_limits.next_allowed_at, now())) + ${interval}
    where coalesce(rate_limits.next_allowed_at, now())
      <= now() + make_interval(secs => ${rule.maxWaitMs / 1000})
    returning greatest(0, extract(epoch from (next_allowed_at - ${interval} - now())) * 1000)
      as wait_ms
  `);
  const row = rowsOf(result)[0] as { wait_ms: number | string } | undefined;
  return row ? Math.ceil(Number(row.wait_ms)) : null;
}

/** Pushes the gate back by `seconds` for every caller (the remote service said it is overloaded). */
export async function deferSlots(db: Db, key: string, seconds: number): Promise<void> {
  const until = sql`now() + make_interval(secs => ${seconds})`;
  await db.execute(sql`
    insert into rate_limits (key, next_allowed_at) values (${key}, ${until})
    on conflict (key) do update set
      next_allowed_at = greatest(coalesce(rate_limits.next_allowed_at, now()), ${until})
  `);
}

function rowsOf(result: unknown): unknown[] {
  return Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
}
