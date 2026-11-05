import type { CatalogProvider } from "@spleen/catalog";
import { inArray, rowsOf, schema, sql, type Db, type SQL } from "@spleen/db";
import type { CatalogSearchInput } from "@spleen/validators";

import type { CatalogSearchResults, RemoteHit } from "../../types";
import { loadArtistCards, loadReleaseCards, loadTrackCards, toReleaseCard } from "./cards";
import { rankedArtists, rankedReleases, rankedTracks } from "./match";

/* Local search first: same matching and order as the instant suggestions (`./match`). */

const LIMIT = { release: 24, artist: 12, track: 20 };
const ALL_LIMIT = { release: 12, artist: 6, track: 8 };

async function rankedIds(db: Db, select: SQL) {
  const result = await db.execute(sql`select k.id from (${select}) k order by k.ord`);
  return rowsOf<{ id: string }>(result).map((r) => r.id);
}

export async function searchCatalog(
  db: Db,
  { q, type }: CatalogSearchInput,
): Promise<CatalogSearchResults> {
  const limits = type === "all" ? ALL_LIMIT : LIMIT;
  const wants = (kind: "release" | "artist" | "track") => type === "all" || type === kind;
  const [releaseIds, artistIds, trackIds] = await Promise.all([
    wants("release") ? rankedIds(db, rankedReleases(q, limits.release)) : [],
    wants("artist") ? rankedIds(db, rankedArtists(q, limits.artist)) : [],
    wants("track") ? rankedIds(db, rankedTracks(q, limits.track)) : [],
  ]);
  const [releases, artists, tracks] = await Promise.all([
    loadReleaseCards(db, releaseIds),
    loadArtistCards(db, artistIds),
    loadTrackCards(db, trackIds),
  ]);
  return { releases: releases.map(toReleaseCard), artists, tracks };
}

const REMOTE_LIMIT = 10;

/** Provider search (MusicBrainz) for what the local catalog does not have yet. */
export async function searchRemote(
  db: Db,
  provider: CatalogProvider,
  { q, type }: CatalogSearchInput,
): Promise<RemoteHit[]> {
  const hits: RemoteHit[] = [];
  if (type === "all" || type === "release") {
    for (const { item } of await provider.searchReleaseGroups(q, REMOTE_LIMIT)) {
      hits.push({
        kind: "release_group",
        mbid: item.mbid,
        title: item.title,
        subtitle: item.artists.map((a) => a.creditName ?? a.artist.name).join(", ") || null,
        type: item.type,
        secondaryTypes: item.secondaryTypes,
        year: item.firstReleaseDate ? Number(item.firstReleaseDate.date.slice(0, 4)) : null,
        localSlug: null,
      });
    }
  }
  if (type === "all" || type === "artist") {
    const limit = type === "all" ? 5 : REMOTE_LIMIT;
    for (const { item } of await provider.searchArtists(q, limit)) {
      hits.push({
        kind: "artist",
        mbid: item.mbid,
        title: item.name,
        subtitle: [item.disambiguation, item.country].filter(Boolean).join(" · ") || null,
        type: null,
        secondaryTypes: [],
        year: null,
        localSlug: null,
      });
    }
  }
  if (type === "track") {
    for (const { item } of await provider.searchRecordings(q, REMOTE_LIMIT)) {
      hits.push({
        kind: "recording",
        mbid: item.mbid,
        title: item.title,
        subtitle: item.artists.map((a) => a.creditName ?? a.artist.name).join(", ") || null,
        type: null,
        secondaryTypes: [],
        year: null,
        localSlug: null,
      });
    }
  }
  return withLocalSlugs(db, hits);
}

/** Marks the hits Spleen already has (a stub release counts: opening it completes it). */
async function withLocalSlugs(db: Db, hits: RemoteHit[]): Promise<RemoteHit[]> {
  const { artists, releases, tracks } = schema;
  const lookup = async (table: typeof artists | typeof releases | typeof tracks, kind: string) => {
    const ids = hits.filter((h) => h.kind === kind).map((h) => h.mbid);
    if (ids.length === 0) return new Map<string, string>();
    const rows = await db
      .select({ mbid: table.mbid, slug: table.slug })
      .from(table as typeof releases)
      .where(inArray(table.mbid, ids));
    return new Map(rows.map((r) => [r.mbid!, r.slug]));
  };
  const [releaseSlugs, artistSlugs, trackSlugs] = await Promise.all([
    lookup(releases, "release_group"),
    lookup(artists, "artist"),
    lookup(tracks, "recording"),
  ]);
  const maps = { release_group: releaseSlugs, artist: artistSlugs, recording: trackSlugs };
  return hits.map((h) => ({ ...h, localSlug: maps[h.kind].get(h.mbid) ?? null }));
}
