/**
 * Re-reads on MusicBrainz the discographies members care about, so new albums reach
 * "Recent releases" (pnpm catalog:refresh). Run nightly by
 * .github/workflows/catalog-refresh.yml on the production database, or by hand on Neon
 * `dev`. Goes through the same global 1 request/s gate as the site. Never run in CI tests.
 */
import { createDb, loadRootEnv, migrationDatabaseUrl } from "@spleen/db";

import { refreshArtistDiscography } from "../src/lib/catalog/import";
import { createCatalogProvider } from "../src/lib/catalog/provider";
import { artistsToRefresh } from "../src/lib/catalog/refresh";

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
// Queue behind site traffic: wait up to 2 minutes for a slot.
const provider = createCatalogProvider(handle.db, { maxWaitMs: 120_000, maxAttempts: 8 });
let added = 0;
let failed = 0;
let total = 0;

try {
  const artists = await artistsToRefresh(handle.db, new Date());
  total = artists.length;
  console.log(`catalog refresh: ${artists.length} artist(s) to re-read (${handle.kind})`);
  for (const [index, artist] of artists.entries()) {
    try {
      const count = await refreshArtistDiscography(handle.db, provider, artist);
      added += count;
      console.log(`[${index + 1}/${artists.length}] +${count} — ${artist.name}`);
    } catch (error) {
      failed++;
      console.log(
        `[${index + 1}/${artists.length}] failed (${(error as Error).name}) — ${artist.name}`,
      );
    }
  }
  console.log(`catalog refresh: done, ${added} release(s) added, ${failed} failed`);
} finally {
  await handle.close();
}
// MusicBrainz often answers 503: a few failures are retried next night. All of them failing
// means something is wrong (user agent, database): make the scheduled run fail visibly.
if (total > 0 && failed === total) process.exitCode = 1;
