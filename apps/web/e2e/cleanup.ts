import {
  createDb,
  deleteE2eAccounts,
  isPostgresUrl,
  loadRootEnv,
  sql,
  unsafeE2eDatabase,
  vitrineRefusal,
} from "@spleen/db";

/**
 * Global setup and teardown: deletes the accounts the suite creates (`e2e-…@example.test`)
 * and their data, including those left by a failed or interrupted run. Postgres only: a
 * local PGlite database belongs to the running dev server process. Refuses production and
 * Neon's `production` branch (`unsafeE2eDatabase`) and the vitrine (`SPLEEN_VITRINE=1`): the
 * whole run stops before any test.
 */
export default async function cleanup() {
  loadRootEnv();
  const vitrine = vitrineRefusal("The e2e cleanup");
  if (vitrine) throw new Error(`[e2e] ${vitrine}`);
  const url = process.env.DATABASE_URL;
  if (!isPostgresUrl(url)) {
    console.warn("[e2e] PGlite database: test accounts are not cleaned up (pnpm db:reset).");
    return;
  }
  const unsafe = unsafeE2eDatabase(url);
  if (unsafe) throw new Error(`[e2e] Refusing to clean up this database: ${unsafe}.`);
  const handle = createDb(url);
  try {
    // "Listen on" links point at records with `restrict`: drop those of the throwaway
    // releases (`throwawayListenPages`) before `deleteE2eAccounts` deletes the releases.
    await handle.db.execute(sql`
      delete from "listen_links" where "release_id" in (
        select "id" from "releases" where "slug" ~ '^e2e-[a-z0-9-]+$' and "mbid" is null)`);
    const count = await deleteE2eAccounts(handle.db);
    if (count > 0) console.log(`[e2e] ${count} test account(s) deleted.`);
  } finally {
    await handle.close();
  }
}
