import { randomUUID } from "node:crypto";

import postgres from "postgres";

import { createDb, isPostgresUrl, type DbHandle } from "./client";

/**
 * A throwaway database for one test file, already migrated.
 * - By default: in-memory PGlite (no server, no network).
 * - With `TEST_DATABASE_URL` (the CI "postgres" job): a fresh database on that Postgres
 *   server, through postgres.js like the app on Neon, dropped on close. One database per
 *   file, so test files still run in parallel. PGlite and postgres.js do not accept the
 *   same parameters (a JS `Date` in raw SQL, for one): this catches what PGlite lets through.
 */
export async function createTestDb(env: NodeJS.ProcessEnv = process.env): Promise<DbHandle> {
  const serverUrl = env.TEST_DATABASE_URL;
  if (!serverUrl) {
    const handle = createDb("memory://");
    await handle.migrate();
    return handle;
  }
  if (!isPostgresUrl(serverUrl)) throw new Error("TEST_DATABASE_URL must start with postgres://.");
  const url = new URL(serverUrl);
  // Tests create and drop databases: never on Neon (a branch holds real data).
  if (url.hostname.endsWith(".neon.tech")) {
    throw new Error("TEST_DATABASE_URL must point to a throwaway server, not Neon.");
  }
  const name = `spleen_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database "${name}"`);
  url.pathname = `/${name}`;
  const handle = createDb(url.toString());
  await handle.migrate();
  return {
    ...handle,
    close: async () => {
      await handle.close();
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.end();
    },
  };
}
