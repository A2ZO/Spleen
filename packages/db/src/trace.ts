/**
 * Development-only SQL trace, read by `apps/web/scripts/measure.mjs` through
 * `/api/trace-debug` (see `docs/environnement.md`). On when `SPLEEN_QUERY_TRACE=1` and
 * `NODE_ENV` is not `production`, so a production build never records anything. Only the start
 * of each statement and its timing are kept: never the parameters (member data, secrets).
 */
import type { Sql } from "postgres";

export interface TracedQuery {
  sql: string;
  start: number;
  end?: number;
}

const key = Symbol.for("spleen.queryTrace");
type TraceGlobal = typeof globalThis & { [key]?: TracedQuery[] };

export function queryTraceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SPLEEN_QUERY_TRACE === "1" && env.NODE_ENV !== "production";
}

function buffer(): TracedQuery[] {
  const g = globalThis as TraceGlobal;
  return (g[key] ??= []);
}

/** Returns the queries recorded since the last call and empties the buffer. */
export function takeQueryTrace(): TracedQuery[] {
  return buffer().splice(0);
}

/**
 * Wraps postgres.js `unsafe()` (the entry point Drizzle uses). Its queries are lazy promises
 * that run on their first `then`, after Drizzle has configured them (`.values()` returns the
 * same object): the query's own `then` is replaced, so its identity and shape do not change.
 */
export function traceQueries(client: Sql): Sql {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (prop !== "unsafe" || typeof value !== "function") return value;
      return (query: string, ...rest: unknown[]) => {
        const pending = (value as (...args: unknown[]) => Promise<unknown>).call(
          target,
          query,
          ...rest,
        );
        const then = pending.then;
        pending.then = function (this: Promise<unknown>, ok, ko) {
          const entry: TracedQuery = {
            sql: query.replace(/\s+/g, " ").slice(0, 60),
            start: performance.now(),
          };
          buffer().push(entry);
          const done = () => (entry.end ??= performance.now());
          return then.call(
            this,
            (v) => (done(), ok ? ok(v) : v),
            (e: unknown) => {
              done();
              if (ko) return ko(e);
              throw e;
            },
          ) as never;
        };
        return pending;
      };
    },
  });
}
