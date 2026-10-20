import { mkdirSync } from "node:fs";
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

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbHandle {
  db: Db;
  /** Applies pending SQL migrations from `packages/db/migrations`. */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
  kind: "postgres" | "pglite";
}

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

/** Local PGlite data directory used when DATABASE_URL is not set: `<repo>/.data/pglite`. */
export const defaultPgliteDir = fileURLToPath(new URL("../../../.data/pglite", import.meta.url));

export function isPostgresUrl(url: string | undefined): url is string {
  return !!url && /^postgres(ql)?:\/\//.test(url);
}

/**
 * Opens the database.
 * - `postgres://…` → a real Postgres server (Neon later), via postgres.js.
 * - `memory://` → throwaway in-memory PGlite (tests).
 * - anything else / undefined → PGlite persisted on disk (local development).
 */
export function createDb(url: string | undefined = process.env.DATABASE_URL): DbHandle {
  if (isPostgresUrl(url)) {
    const client = postgres(url, { max: 5 });
    const db = drizzlePostgres(client, { schema });
    return {
      db: db as unknown as Db,
      kind: "postgres",
      migrate: () => migratePostgres(db, { migrationsFolder }),
      close: () => client.end(),
    };
  }

  const dataDir = url ?? defaultPgliteDir;
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
