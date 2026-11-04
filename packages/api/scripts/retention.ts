/**
 * Nightly retention (pnpm retention): anonymises moderation decisions a year old and deletes
 * the closed reports, then deletes expired sessions, expired sign-in links and anti-abuse
 * counters 24 hours after their window (rules in src/lib/retention.ts). Run nightly by
 * .github/workflows/catalog-refresh.yml on the production database; safe to run by hand
 * (idempotent). Prints counts only.
 */
import { createDb, loadRootEnv, migrationDatabaseUrl } from "@spleen/db";

import { runRetention } from "../src/lib/retention";

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
try {
  const done = await runRetention(handle.db, new Date());
  console.log(
    `retention (${handle.kind}): ${done.actions} decision(s) anonymised, ${done.reports} closed report(s), ` +
      `${done.sessions} expired session(s), ${done.verifications} expired sign-in link(s), ` +
      `${done.rateLimits} old counter(s) deleted`,
  );
} finally {
  await handle.close();
}
