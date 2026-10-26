/**
 * Moderation retention (pnpm moderation:anonymize): one year after each decision, keeps only
 * its action, reason and report category, and deletes the closed reports. Run nightly by
 * .github/workflows/catalog-refresh.yml on the production database; safe to run by hand
 * (idempotent). Prints counts only.
 */
import { createDb, loadRootEnv, migrationDatabaseUrl } from "@spleen/db";

import { anonymizeModerationHistory } from "../src/lib/moderation/history";

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
try {
  const { actions, reports } = await anonymizeModerationHistory(handle.db, new Date());
  console.log(
    `moderation retention (${handle.kind}): ${actions} decision(s) anonymised, ${reports} closed report(s) deleted`,
  );
} finally {
  await handle.close();
}
