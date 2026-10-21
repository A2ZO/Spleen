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
  const result = await db.execute<{ count: number; retry_after: number }>(sql`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start <= now() - ${window}
        then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start <= now() - ${window}
        then now() else rate_limits.window_start end
    returning count,
      ceil(extract(epoch from (window_start + ${window} - now())))::int as retry_after
  `);
  const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
  const row = rows[0] as { count: number; retry_after: number };
  const allowed = Number(row.count) <= rule.max;
  return { allowed, retryAfter: allowed ? null : Math.max(1, Number(row.retry_after)) };
}
