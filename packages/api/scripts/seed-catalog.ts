/**
 * Pre-fills the catalog from MusicBrainz (pnpm db:seed:catalog): the artists (with their
 * discography as stubs) and releases (with tracklists) listed in catalog-seed.json.
 * Goes through the same global 1 request/s gate as the site, so it can run while the site is
 * up. Idempotent: what is already imported is skipped. Never run in CI.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMainRelease, type CatalogProvider } from "@spleen/catalog";
import { createDb, loadRootEnv, migrationDatabaseUrl, slugify, sql, type Db } from "@spleen/db";

import { importArtist, importReleaseGroup } from "../src/lib/catalog/import";
import { createCatalogProvider } from "../src/lib/catalog/provider";

interface SeedList {
  artists: string[];
  releases: { artist: string; title: string }[];
}

/**
 * Search hits examined per release. MusicBrainz scores are relative (the real "Rumours"
 * scores 70 behind a compilation titled "Fleetwood Mac / Rumours"), so hits are matched on
 * exact title and artist instead of a score threshold.
 */
const SEARCH_LIMIT = 25;

const here = path.dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(readFileSync(path.join(here, "catalog-seed.json"), "utf8")) as SeedList;
const same = (a: string, b: string) => slugify(a) === slugify(b);
const overlaps = (a: string, b: string) =>
  slugify(a).includes(slugify(b)) || slugify(b).includes(slugify(a));

async function alreadyImported(db: Db, artist: string, title: string): Promise<boolean> {
  const result = await db.execute(sql`
    select 1 from releases r
    join release_artists ra on ra.release_id = r.id
    join artists a on a.id = ra.artist_id
    where r.tracklist_imported_at is not null
      and lower(immutable_unaccent(r.title)) = lower(immutable_unaccent(${title}))
      and lower(immutable_unaccent(a.name)) = lower(immutable_unaccent(${artist}))
    limit 1
  `);
  const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
  return rows.length > 0;
}

async function seedArtist(db: Db, provider: CatalogProvider, name: string) {
  const hits = await provider.searchArtists(name, 5);
  const hit = hits.find((h) => same(h.item.name, name)) ?? null;
  if (!hit) return null;
  return importArtist(db, provider, hit.item.mbid);
}

async function seedRelease(db: Db, provider: CatalogProvider, artist: string, title: string) {
  if (await alreadyImported(db, artist, title)) return "skipped";
  const hits = await provider.searchReleaseGroups(`${artist} ${title}`, SEARCH_LIMIT);
  const matches = hits.filter(
    ({ item }) =>
      same(item.title, title) &&
      item.artists.some((credit) => overlaps(credit.artist.name, artist)),
  );
  // The studio album rather than its live version or a reissue compilation of the same name.
  const hit = matches.find(({ item }) => isMainRelease(item.secondaryTypes)) ?? matches[0];
  if (!hit) return null;
  return importReleaseGroup(db, provider, hit.item.mbid);
}

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
// Scripts may queue behind site traffic: wait up to 2 minutes for a slot.
const provider = createCatalogProvider(handle.db, { maxWaitMs: 120_000, maxAttempts: 8 });
const missing: string[] = [];
const failed: string[] = [];
const total = list.artists.length + list.releases.length;
let done = 0;

async function step(label: string, run: () => Promise<string | null>) {
  done++;
  try {
    const result = await run();
    if (result === null) missing.push(label);
    console.log(`[${done}/${total}] ${result === null ? "not found" : result} — ${label}`);
  } catch (error) {
    failed.push(label);
    console.log(`[${done}/${total}] failed (${(error as Error).message}) — ${label}`);
  }
}

try {
  await handle.migrate();
  for (const name of list.artists) {
    await step(`artist ${name}`, () => seedArtist(handle.db, provider, name));
  }
  for (const { artist, title } of list.releases) {
    await step(`${artist} — ${title}`, () => seedRelease(handle.db, provider, artist, title));
  }
  console.log(
    `catalog: done (${handle.kind}), ${missing.length} not found, ${failed.length} failed`,
  );
  for (const label of [...missing, ...failed]) console.log(`  - ${label}`);
} finally {
  await handle.close();
}
