import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "./schema";
import { queryTraceEnabled, traceQueries } from "./trace";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbHandle {
  db: Db;
  /** Applies pending SQL migrations from `packages/db/migrations`. */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
  kind: "postgres" | "pglite";
}

// `path.resolve` rather than `new URL(…, import.meta.url)`, which bundlers (Next) would try to
// pull into the bundle as assets.
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../migrations");

/** Local PGlite data directory used when DATABASE_URL is not set: `<repo>/.data/pglite`. */
export const defaultPgliteDir = path.resolve(here, "../../../.data/pglite");

export function isPostgresUrl(url: string | undefined): url is string {
  return !!url && /^postgres(ql)?:\/\//.test(url);
}

/**
 * Connection for migrations and the seed. On Postgres they need the DIRECT connection
 * (`DATABASE_URL_UNPOOLED`): Neon's pooler is PgBouncer in transaction mode, which migration
 * tools do not support. `DATABASE_URL` stays the switch: unset → local PGlite, as for the app.
 */
export function migrationDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!isPostgresUrl(env.DATABASE_URL)) return env.DATABASE_URL;
  const direct = env.DATABASE_URL_UNPOOLED;
  if (!direct || !isPostgresUrl(direct)) {
    throw new Error(
      "DATABASE_URL_UNPOOLED (direct connection) is required to migrate or seed a Postgres database.",
    );
  }
  return direct;
}

/**
 * Opens the database.
 * - `postgres://…` → a Postgres server (Neon), via postgres.js. The app passes the pooled
 *   `DATABASE_URL`; scripts pass `migrationDatabaseUrl()`.
 * - `memory://` → throwaway in-memory PGlite (tests).
 * - a directory path / unset or empty → PGlite persisted on disk (local development).
 */
export function createDb(url: string | undefined = process.env.DATABASE_URL): DbHandle {
  if (url && isPostgresUrl(url)) {
    const raw = postgres(url, {
      max: 5,
      // Close idle connections quickly (serverless) and allow for Neon waking up from sleep.
      idle_timeout: 20,
      connect_timeout: 15,
      // Silences "already exists, skipping" notices from idempotent migrations.
      onnotice: () => {},
    });
    // Development measurements only (`docs/environnement.md`); never on in production.
    const client = queryTraceEnabled() ? traceQueries(raw) : raw;
    const db = drizzlePostgres(client, { schema });
    return {
      db: db as unknown as Db,
      kind: "postgres",
      migrate: () => migratePostgres(db, { migrationsFolder }),
      close: () => client.end(),
    };
  }

  // A malformed URL (stray quotes, typo in the scheme) must fail loudly, not become a PGlite
  // directory named after it. The value is never echoed: it holds a password.
  if (url?.includes("://") && !url.startsWith("memory://")) {
    throw new Error(
      "Database URL must start with postgres:// or postgresql:// (check quotes and spaces in .env).",
    );
  }
  const dataDir = url || defaultPgliteDir;
  if (!dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir, { extensions: { pg_trgm, unaccent } });
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as Db,
    kind: "pglite",
    migrate: () => migratePglite(db, { migrationsFolder }),
    close: () => client.close(),
  };
}
