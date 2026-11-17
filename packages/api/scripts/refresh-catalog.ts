/**
 * Re-reads on MusicBrainz the discographies members care about, so new albums reach
 * "Recent releases", after feeding the upcoming releases of followed artists from
 * ListenBrainz (pnpm catalog:refresh). Run nightly by
 * .github/workflows/catalog-refresh.yml on the production database, or by hand on Neon
 * `dev`. Then re-reads the "Listen on" links (capped, docs/catalogue.md); `--links-only` runs
 * that phase alone. Goes through the same global 1 request/s gate as the site. Never run in CI
 * tests.
 */
import { createListenBrainzClient } from "@spleen/catalog";
import { createDb, loadRootEnv, migrationDatabaseUrl, unsafeE2eDatabase } from "@spleen/db";

import { refreshArtistDiscography } from "../src/lib/catalog/import";
import { refreshListenLinks } from "../src/lib/catalog/listen-links-refresh";
import { createCatalogProvider } from "../src/lib/catalog/provider";
import { artistsToRefresh } from "../src/lib/catalog/refresh";
import { runUpcomingFeed } from "../src/lib/catalog/upcoming-feed";

loadRootEnv();
const linksOnly = process.argv.includes("--links-only");
const databaseUrl = migrationDatabaseUrl();
const handle = createDb(databaseUrl);
// Queue behind site traffic: wait up to 2 minutes for a slot.
const provider = createCatalogProvider(handle.db, { maxWaitMs: 120_000, maxAttempts: 8 });
let added = 0;
let failed = 0;
let total = 0;

try {
  if (!linksOnly) {
    // Announced releases of followed artists first (ListenBrainz, then MusicBrainz); a
    // ListenBrainz failure is only reported.
    const listenBrainz = createListenBrainzClient({
      userAgent: process.env.MUSICBRAINZ_USER_AGENT,
    });
    const feed = await runUpcomingFeed(handle.db, provider, listenBrainz, new Date(), console.log);
    console.log(
      `upcoming: ListenBrainz ${feed.listenBrainz}, ${feed.matched} matched, ` +
        `${feed.imported} imported, ${feed.completed} completed, ${feed.datesChecked} date(s) ` +
        `checked, ${feed.failed} failed, ${feed.skipped} left for later`,
    );

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
  }

  // "Listen on" links last: its errors are only reported and never change the exit code.
  try {
    // Fewer tries than the other phases, so one request cannot overrun the budget for long.
    const linksProvider = createCatalogProvider(handle.db, { maxWaitMs: 120_000, maxAttempts: 3 });
    const devDatabase = !databaseUrl || unsafeE2eDatabase(databaseUrl) === null;
    console.log(`links: ${handle.kind}, not Neon's production branch: ${devDatabase}`);
    const links = await refreshListenLinks(handle.db, linksProvider, {
      now: new Date(),
      log: console.log,
    });
    console.log(
      `links: ${links.releases} disque(s), ${links.artists} artiste(s) relus, ` +
        `${links.links} lien(s), ${links.failed} échec(s), ${links.deferred} pour plus tard`,
    );
  } catch (error) {
    console.log(`links: failed (${(error as Error).name})`);
  }
} finally {
  await handle.close();
}
// MusicBrainz often answers 503: a few failures are retried next night. All of them failing
// means something is wrong (user agent, database): make the scheduled run fail visibly.
if (total > 0 && failed === total) process.exitCode = 1;
