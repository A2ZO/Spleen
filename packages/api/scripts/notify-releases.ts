/**
 * Nightly « Sortie aujourd'hui » (pnpm releases:notify): one in-site notification per member
 * and record of a followed artist out today in their zone (rules in
 * src/lib/catalog/release-notifications.ts). Run nightly by .github/workflows/catalog-refresh.yml
 * after the discography refresh, on the production database; safe to run by hand or again
 * (never twice for the same record). Prints a count only.
 */
import { createDb, loadRootEnv, migrationDatabaseUrl } from "@spleen/db";

import { notifyReleasesOfDay } from "../src/lib/catalog/release-notifications";

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
try {
  const created = await notifyReleasesOfDay(handle.db, new Date());
  console.log(`releases:notify (${handle.kind}): ${created} notification(s) created`);
} finally {
  await handle.close();
}
