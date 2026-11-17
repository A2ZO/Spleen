import { isCatalogError, rankEditions, type CatalogProvider } from "@spleen/catalog";
import { and, asc, eq, isNotNull, isNull, lt, or, schema, sql, type Db } from "@spleen/db";

import { pickListenLinks } from "../listen-links";
import { storeListenLinks } from "./import";

/*
 * Nightly re-read of the "Listen on" links (docs/catalogue.md, « Écouter sur… »): complete
 * records and imported artists, never re-read first, then the ones read more than 30 days ago.
 * Capped (200 records, 100 artists, 10 minutes); the rest waits for the next night. Tracks are
 * never re-read at night (one more request per record): they get their links at import.
 */

const { artists, releases } = schema;

export const LINKS_RELEASE_BATCH = 200;
export const LINKS_ARTIST_BATCH = 100;
export const LINKS_BUDGET_MS = 10 * 60 * 1000;
/** Links of a record or an artist are re-read at most once in this many days. */
export const LINKS_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LinksTarget {
  id: string;
  mbid: string;
}

const staleBefore = (now: Date) => new Date(now.getTime() - LINKS_AFTER_DAYS * DAY_MS);

/** Complete, unmerged records with an mbid whose links were never read or are stale. */
export async function releasesForLinks(
  db: Db,
  now: Date,
  limit = LINKS_RELEASE_BATCH,
): Promise<LinksTarget[]> {
  const rows = await db
    .select({ id: releases.id, mbid: releases.mbid })
    .from(releases)
    .where(
      and(
        isNotNull(releases.tracklistImportedAt),
        isNotNull(releases.mbid),
        isNull(releases.mergedIntoId),
        or(isNull(releases.linksCheckedAt), lt(releases.linksCheckedAt, staleBefore(now))),
      ),
    )
    .orderBy(
      sql`${releases.linksCheckedAt} is not null`,
      sql`case when ${releases.linksCheckedAt} is null then ${releases.tracklistImportedAt} end desc nulls last`,
      asc(releases.linksCheckedAt),
      asc(releases.id),
    )
    .limit(limit);
  return rows.map((row) => ({ id: row.id, mbid: row.mbid! }));
}

/** Unmerged artists with an mbid and an imported discography, same order as the records. */
export async function artistsForLinks(
  db: Db,
  now: Date,
  limit = LINKS_ARTIST_BATCH,
): Promise<LinksTarget[]> {
  const rows = await db
    .select({ id: artists.id, mbid: artists.mbid })
    .from(artists)
    .where(
      and(
        isNotNull(artists.discographyImportedAt),
        isNotNull(artists.mbid),
        isNull(artists.mergedIntoId),
        or(isNull(artists.linksCheckedAt), lt(artists.linksCheckedAt, staleBefore(now))),
      ),
    )
    .orderBy(
      sql`${artists.linksCheckedAt} is not null`,
      sql`case when ${artists.linksCheckedAt} is null then ${artists.discographyImportedAt} end desc nulls last`,
      asc(artists.linksCheckedAt),
      asc(artists.id),
    )
    .limit(limit);
  return rows.map((row) => ({ id: row.id, mbid: row.mbid! }));
}

export interface RefreshLinksOptions {
  now: Date;
  /** Elapsed-time source (tests); `Date.now` by default. */
  clock?: () => number;
  budgetMs?: number;
  releaseLimit?: number;
  artistLimit?: number;
  log?: (line: string) => void;
}

export interface RefreshLinksResult {
  releases: number;
  artists: number;
  /** Links stored (added or updated). */
  links: number;
  failed: number;
  /** Queued records and artists left for the next night (budget or MusicBrainz down). */
  deferred: number;
}

export async function refreshListenLinks(
  db: Db,
  provider: CatalogProvider,
  options: RefreshLinksOptions,
): Promise<RefreshLinksResult> {
  const { now, budgetMs = LINKS_BUDGET_MS, log = () => {} } = options;
  const clock = options.clock ?? Date.now;
  const started = clock();
  const result: RefreshLinksResult = { releases: 0, artists: 0, links: 0, failed: 0, deferred: 0 };
  const releaseQueue = await releasesForLinks(db, now, options.releaseLimit);
  const artistQueue = await artistsForLinks(db, now, options.artistLimit);
  let stopped = false;

  const run = async (queue: LinksTarget[], read: (target: LinksTarget) => Promise<void>) => {
    for (const [index, target] of queue.entries()) {
      if (stopped || clock() - started >= budgetMs) {
        stopped = true;
        result.deferred += queue.length - index;
        return;
      }
      try {
        await read(target);
      } catch (error) {
        result.failed++;
        log(`links: failed (${(error as Error).name}) — ${target.mbid}`);
        if (isCatalogError(error) && error.kind !== "not_found") {
          // MusicBrainz down or busy: nothing more tonight.
          stopped = true;
          result.deferred += queue.length - index - 1;
          return;
        }
      }
    }
  };

  await run(releaseQueue, async (release) => {
    let answer;
    try {
      answer = await provider.getEditionLinks(release.mbid);
    } catch (error) {
      if (!isCatalogError(error) || error.kind !== "not_found") throw error;
      answer = null;
    }
    if (!answer || answer.editions.length === 0) {
      // Gone at MusicBrainz (or emptied): the links are kept.
      await db.update(releases).set({ linksCheckedAt: now }).where(eq(releases.id, release.id));
      result.releases++;
      return;
    }
    const relations = rankEditions(answer.editions).flatMap((edition) => edition.urlRelations);
    const links = pickListenLinks(relations, "release");
    const complete = answer.total <= answer.editions.length;
    await db.transaction(async (tx) => {
      await storeListenLinks(tx, "release", release.id, links, now, { removeMissing: complete });
      await tx.update(releases).set({ linksCheckedAt: now }).where(eq(releases.id, release.id));
    });
    result.releases++;
    result.links += links.length;
  });

  await run(artistQueue, async (artist) => {
    let answer;
    try {
      answer = await provider.getArtist(artist.mbid);
    } catch (error) {
      if (!isCatalogError(error) || error.kind !== "not_found") throw error;
      answer = null;
    }
    if (!answer) {
      await db.update(artists).set({ linksCheckedAt: now }).where(eq(artists.id, artist.id));
      result.artists++;
      return;
    }
    const links = pickListenLinks(answer.urlRelations ?? [], "artist");
    await db.transaction(async (tx) => {
      await storeListenLinks(tx, "artist", artist.id, links, now, { removeMissing: true });
      await tx.update(artists).set({ linksCheckedAt: now }).where(eq(artists.id, artist.id));
    });
    result.artists++;
    result.links += links.length;
  });

  return result;
}
