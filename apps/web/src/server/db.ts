import "server-only";

import { createDb, type Db, type DbHandle } from "@spleen/db";

const globalForDb = globalThis as typeof globalThis & { spleenDb?: DbHandle };

/**
 * One connection pool per server process, kept across hot reloads in dev. Uses the pooled
 * DATABASE_URL (Neon), or the local PGlite database when it is unset.
 */
export function getDb(): Db {
  globalForDb.spleenDb ??= createDb();
  return globalForDb.spleenDb.db;
}
