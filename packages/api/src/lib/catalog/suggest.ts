import { rowsOf, sql, type Db } from "@spleen/db";
import type { ReleaseType } from "@spleen/validators";

import type { CatalogSuggestions, MemberSuggestion, Suggestion } from "../../types";
import { normalized, prefix, rankedArtists, rankedReleases, rankedTracks } from "./match";

/*
 * Instant suggestions (docs/catalogue.md, "Recherche"): one SQL statement for the three kinds,
 * only the fields shown, nothing about the viewer (the answer is cached by the CDN and is the
 * same for everyone). Never the catalog provider.
 */

/** Per kind: one may become the best result, three remain in its group. */
const PER_KIND = 4;
const SHOWN = 3;
const MEMBERS = 5;

type Row = {
  kind: Suggestion["kind"];
  slug: string;
  title: string;
  subtitle: string | null;
  cover_slug: string | null;
  cover_title: string | null;
  cover_url: string | null;
  year: number | null;
  release_type: ReleaseType | null;
  starts: boolean;
  pop: number;
  score: number;
  ord: number;
};

/** Kind order when everything else is equal: an artist named like the query wins. */
const KIND_ORDER = { artist: 0, release: 1, track: 2 } as const;

const better = (a: Row, b: Row) =>
  Number(b.starts) - Number(a.starts) ||
  b.pop - a.pop ||
  b.score - a.score ||
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind];

export async function suggestCatalog(db: Db, q: string): Promise<CatalogSuggestions> {
  if (q.startsWith("@")) {
    return {
      best: null,
      artists: [],
      releases: [],
      tracks: [],
      members: await suggestMembers(db, q.slice(1)),
    };
  }
  const result = await db.execute(sql`
    select 'release' as kind, r.slug, r.title,
      (select string_agg(a.name, ', ' order by ra.position) from release_artists ra
        join artists a on a.id = ra.artist_id where ra.release_id = r.id) as subtitle,
      r.slug as cover_slug, r.title as cover_title, r.cover_url,
      extract(year from r.release_date)::int as year, r.type::text as release_type,
      k.starts, k.pop, k.score, k.ord::int as ord
    from (${rankedReleases(q, PER_KIND)}) k join releases r on r.id = k.id
    union all
    select 'artist', a.slug, a.name, a.disambiguation,
      a.slug, a.name, a.image_url, null, null,
      k.starts, k.pop, k.score, k.ord::int
    from (${rankedArtists(q, PER_KIND)}) k join artists a on a.id = k.id
    union all
    select 'track', t.slug, t.title,
      (select string_agg(a.name, ', ' order by ta.position) from track_artists ta
        join artists a on a.id = ta.artist_id where ta.track_id = t.id),
      f.slug, f.title, f.cover_url, null, null,
      k.starts, k.pop, k.score, k.ord::int
    from (${rankedTracks(q, PER_KIND)}) k join tracks t on t.id = k.id
    left join lateral (
      select r.slug, r.title, r.cover_url from release_tracks rt
        join releases r on r.id = rt.release_id
        where rt.track_id = t.id and r.merged_into_id is null
        order by r.release_date asc nulls last, r.slug
        limit 1
    ) f on true
  `);
  const rows = rowsOf<Row>(result);
  const best = rows.reduce<Row | null>(
    (top, row) => (!top || better(row, top) < 0 ? row : top),
    null,
  );
  const group = (kind: Row["kind"]) =>
    rows
      .filter((r) => r.kind === kind && r !== best)
      .sort((a, b) => a.ord - b.ord)
      .slice(0, SHOWN)
      .map(toSuggestion);
  return {
    best: best ? toSuggestion(best) : null,
    artists: group("artist"),
    releases: group("release"),
    tracks: group("track"),
    members: [],
  };
}

const toSuggestion = (row: Row): Suggestion => ({
  kind: row.kind,
  slug: row.slug,
  title: row.title,
  subtitle: row.subtitle,
  cover: row.cover_slug
    ? { slug: row.cover_slug, title: row.cover_title ?? row.title, url: row.cover_url }
    : null,
  year: row.year,
  releaseType: row.release_type,
});

/** "@nuit": usernames starting with it first, then display names that look like it. */
async function suggestMembers(db: Db, q: string): Promise<MemberSuggestion[]> {
  if (q.trim() === "") return [];
  const query = normalized(q);
  const starts = sql`lower(p.username) like ${prefix(q)}`;
  const name = sql`lower(immutable_unaccent(p.display_name))`;
  const result = await db.execute(sql`
    select p.username, p.display_name, p.avatar_url from profiles p
    where p.suspended_at is null
      and (${starts} or ${name} %> ${query} or ${name} like immutable_unaccent(${prefix(q)}))
    order by ${starts} desc, word_similarity(${query}, ${name}) desc, p.username
    limit ${MEMBERS}
  `);
  return rowsOf<{ username: string; display_name: string; avatar_url: string | null }>(result).map(
    (r) => ({ username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }),
  );
}
