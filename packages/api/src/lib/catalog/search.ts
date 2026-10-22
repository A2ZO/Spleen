import { MAIN_SECONDARY_TYPES, type CatalogProvider } from "@spleen/catalog";
import { inArray, schema, sql, type Db } from "@spleen/db";
import type { CatalogSearchInput } from "@spleen/validators";

import type { CatalogSearchResults, RemoteHit } from "../../types";
import { loadArtistCards, loadReleaseCards, loadTrackCards, toReleaseCard } from "./cards";

/*
 * Local search first: accent- and case-insensitive, typo-tolerant (pg_trgm word similarity on
 * the `lower(immutable_unaccent(...))` expressions the trigram indexes are built on), plus a
 * prefix match for very short queries. "miles davis kind of blue" works because a title or an
 * artist name found *inside* the query also counts.
 */

const LIMIT = { release: 24, artist: 12, track: 20 };
const ALL_LIMIT = { release: 12, artist: 6, track: 8 };

/** Live albums, compilations… rank just after main releases of equal score. */
const mainTypes = sql`array[${sql.join(
  MAIN_SECONDARY_TYPES.map((t) => sql`${t}`),
  sql`, `,
)}]::text[]`;

const searchable = (column: unknown) => sql`lower(immutable_unaccent(${column}))`;

/** Query text normalised like the indexed expressions. */
const normalized = (q: string) => sql`lower(immutable_unaccent(${q}))`;

/** LIKE pattern for "starts with", with the user's wildcards escaped. */
const prefix = (q: string) => `${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;

/** Candidates and score for one text column: query in the text, or the text in the query. */
function matches(column: unknown, q: string) {
  const text = searchable(column);
  const query = normalized(q);
  return {
    where: sql`(${text} %> ${query} or ${text} <% ${query} or ${text} like immutable_unaccent(${prefix(q)}))`,
    score: sql`greatest(
      word_similarity(${query}, ${text}),
      word_similarity(${text}, ${query}) * 0.9,
      case when ${text} = ${query} then 1.2 else 0 end
    )`,
  };
}

const rowsOf = (result: unknown) =>
  (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { id: string }[];

async function searchReleaseIds(db: Db, q: string, limit: number) {
  const { releases, releaseArtists, artists } = schema;
  const title = matches(releases.title, q);
  const artist = matches(artists.name, q);
  // A release scores on its title, plus half its best artist score ("artist + title" queries).
  const result = await db.execute(sql`
    with candidates as (
      select ${releases.id} as id from ${releases} where ${title.where}
      union
      select ${releaseArtists.releaseId} from ${releaseArtists}
        join ${artists} on ${artists.id} = ${releaseArtists.artistId}
        where ${artist.where}
    )
    select ${releases.id} as id
    from candidates c
    join ${releases} on ${releases.id} = c.id
    left join ${releaseArtists} on ${releaseArtists.releaseId} = ${releases.id}
    left join ${artists} on ${artists.id} = ${releaseArtists.artistId}
    group by ${releases.id}
    order by ${title.score} + 0.5 * coalesce(max(${artist.score}), 0)
      + case when ${releases.secondaryTypes} <@ ${mainTypes} then 0.05 else 0 end desc,
      ${releases.releaseDate} asc nulls last
    limit ${limit}
  `);
  return rowsOf(result).map((r) => r.id);
}

async function searchArtistIds(db: Db, q: string, limit: number) {
  const { artists } = schema;
  const name = matches(artists.name, q);
  const result = await db.execute(sql`
    select ${artists.id} as id from ${artists}
    where ${name.where}
    order by ${name.score} desc, ${artists.name}
    limit ${limit}
  `);
  return rowsOf(result).map((r) => r.id);
}

async function searchTrackIds(db: Db, q: string, limit: number) {
  const { tracks, trackArtists, artists } = schema;
  const title = matches(tracks.title, q);
  const artist = matches(artists.name, q);
  const result = await db.execute(sql`
    select ${tracks.id} as id
    from ${tracks}
    left join ${trackArtists} on ${trackArtists.trackId} = ${tracks.id}
    left join ${artists} on ${artists.id} = ${trackArtists.artistId}
    where ${title.where}
    group by ${tracks.id}
    order by ${title.score} + 0.5 * coalesce(max(${artist.score}), 0) desc, ${tracks.title}
    limit ${limit}
  `);
  return rowsOf(result).map((r) => r.id);
}

export async function searchCatalog(
  db: Db,
  { q, type }: CatalogSearchInput,
): Promise<CatalogSearchResults> {
  const limits = type === "all" ? ALL_LIMIT : LIMIT;
  const wants = (kind: "release" | "artist" | "track") => type === "all" || type === kind;
  const [releaseIds, artistIds, trackIds] = await Promise.all([
    wants("release") ? searchReleaseIds(db, q, limits.release) : [],
    wants("artist") ? searchArtistIds(db, q, limits.artist) : [],
    wants("track") ? searchTrackIds(db, q, limits.track) : [],
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
