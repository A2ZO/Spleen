import { createDb, deleteE2eAccounts, isPostgresUrl, loadRootEnv } from "@spleen/db";

/**
 * Global setup and teardown: deletes the accounts the suite creates (`e2e-…@example.test`)
 * and their data, including those left by a failed or interrupted run. Postgres only: a
 * local PGlite database belongs to the running dev server process.
 */
export default async function cleanup() {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!isPostgresUrl(url)) {
    console.warn("[e2e] PGlite database: test accounts are not cleaned up (pnpm db:reset).");
    return;
  }
  const handle = createDb(url);
  try {
    const count = await deleteE2eAccounts(handle.db);
    if (count > 0) console.log(`[e2e] ${count} test account(s) deleted.`);
  } finally {
    await handle.close();
  }
}
