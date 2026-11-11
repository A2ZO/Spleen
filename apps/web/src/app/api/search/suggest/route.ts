import { isApiErrorCode } from "@spleen/api";
import { queryTraceEnabled, takeQueryTrace } from "@spleen/db";
import { clientIp, createMemoryRateLimiter } from "@spleen/infra/memory-rate-limit";
import { catalogSuggestSchema } from "@spleen/validators";
import { TRPCError } from "@trpc/server";

import { getPublicApi } from "@/server/api";

export const dynamic = "force-dynamic";

/*
 * Instant search: `GET /api/search/suggest?q=…` (also for the Expo app). Rules in
 * docs/catalogue.md, "Recherche". The answer never depends on who asks (session-free caller,
 * no cookie read or set), so the CDN may keep it briefly and serve it to everyone.
 */

/** 1 minute fresh, then served stale for 10 minutes while the CDN fetches a new copy. */
const PUBLIC_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=600";

/** Per IP and per instance: bursts of 30, then 3 per second (≈ 180 per minute). */
const limiter = createMemoryRateLimiter({ capacity: 30, refillPerSecond: 3, maxKeys: 10_000 });

const noStore = (status: number, extra: Record<string, string> = {}) =>
  Response.json({ error: status }, { status, headers: { "cache-control": "no-store", ...extra } });

export async function GET(request: Request) {
  const started = performance.now();
  const cpu = process.cpuUsage();
  const tracing = queryTraceEnabled();
  if (tracing) takeQueryTrace();

  const limit = limiter.take(clientIp(request.headers));
  if (!limit.allowed) return noStore(429, { "retry-after": String(limit.retryAfter) });

  const input = catalogSuggestSchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });
  if (!input.success) return noStore(400);

  let body;
  try {
    body = await (await getPublicApi()).catalog.suggest(input.data);
  } catch (error) {
    // Never the raw error (it may hold SQL): a code at most.
    const code = error instanceof TRPCError && isApiErrorCode(error.message) ? error.message : null;
    console.error("search suggest failed", code ?? "");
    return noStore(500);
  }

  const headers: Record<string, string> = {
    "cache-control": PUBLIC_CACHE,
    vary: "accept-encoding",
  };
  // Development measurement only (scripts/measure-search.mjs): time in base and CPU.
  if (tracing) {
    const db = takeQueryTrace().reduce((sum, q) => sum + ((q.end ?? q.start) - q.start), 0);
    const { user, system } = process.cpuUsage(cpu);
    headers["server-timing"] = [
      `db;dur=${db.toFixed(1)}`,
      `cpu;dur=${((user + system) / 1000).toFixed(1)}`,
      `app;dur=${(performance.now() - started).toFixed(1)}`,
    ].join(", ");
  }
  return Response.json(body, { headers });
}
