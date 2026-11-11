import { MAIN_SECONDARY_TYPES } from "@spleen/catalog";
import { sql, type SQL } from "@spleen/db";

/*
 * Text matching and ranking shared by the search page and the instant suggestions, so both
 * agree on what comes first. Accent- and case-insensitive, typo-tolerant (pg_trgm word
 * similarity on the `lower(immutable_unaccent(...))` expressions the trigram indexes are built
 * on), plus a prefix match for very short queries. "miles davis kind of blue" works because a
 * title or an artist name found *inside* the query also counts.
 *
 * Order (docs/catalogue.md, "Recherche"): what starts with the query, then popularity on
 * Spleen (distinct members who listened), then similarity. Popularity is only counted for the
 * `PRE_CUT` best text matches of each kind, which keeps the cost flat as the catalog grows.
 */

const PRE_CUT = 30;

/** Live albums, compilations… rank just after main releases of equal score. */
const mainTypes = sql`array[${sql.join(
  MAIN_SECONDARY_TYPES.map((t) => sql`${t}`),
  sql`, `,
)}]::text[]`;

export const searchable = (column: SQL) => sql`lower(immutable_unaccent(${column}))`;

/** Query text normalised like the indexed expressions. */
export const normalized = (q: string) => sql`lower(immutable_unaccent(${q}))`;

/** LIKE pattern for "starts with", with the user's wildcards escaped. */
export const prefix = (q: string) => `${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;

/** Candidates, score and "starts with" for one text column. */
export function matches(column: SQL, q: string) {
  const text = searchable(column);
  const query = normalized(q);
  const starts = sql`(${text} like immutable_unaccent(${prefix(q)}))`;
  return {
    where: sql`(${text} %> ${query} or ${text} <% ${query} or ${starts})`,
    starts,
    score: sql`greatest(
      word_similarity(${query}, ${text}),
      word_similarity(${text}, ${query}) * 0.9,
      case when ${text} = ${query} then 1.2 else 0 end
    )`,
  };
}

/**
 * Each ranked select returns `id, starts, pop, score, ord` (ord = 1 for the best), at most
 * `limit` rows. They are plain subqueries (no CTE names), so several fit in one statement.
 */
const ranked = (inner: SQL, pop: SQL, tiebreak: SQL, limit: number) => sql`
  select p.id, p.starts, p.pop, p.score,
    row_number() over (order by p.starts desc, p.pop desc, p.score desc, ${tiebreak}) as ord
  from (
    select s.*, (${pop})::int as pop from (${inner}) s
  ) p
  order by ord
  limit ${limit}
`;

export function rankedReleases(q: string, limit: number) {
  const title = matches(sql.raw("r.title"), q);
  const artist = matches(sql.raw("a.name"), q);
  // A release scores on its title, plus half its best artist score ("artist + title" queries).
  const inner = sql`
    select r.id, r.release_date, ${title.starts} as starts,
      (${title.score} + 0.5 * coalesce(max(${artist.score}), 0)
        + case when r.secondary_types <@ ${mainTypes} then 0.05 else 0 end)::float8 as score
    from (
      select r.id from releases r where ${title.where}
      union
      select ra.release_id from release_artists ra
        join artists a on a.id = ra.artist_id
        where ${artist.where}
    ) c
    join releases r on r.id = c.id
    left join release_artists ra on ra.release_id = r.id
    left join artists a on a.id = ra.artist_id
    where r.merged_into_id is null
    group by r.id
    order by starts desc, score desc
    limit ${PRE_CUT}
  `;
  const pop = sql`select count(distinct u.user_id) from user_item_state u
    where u.release_id = s.id and u.listened`;
  return ranked(inner, pop, sql`p.release_date asc nulls last`, limit);
}

export function rankedArtists(q: string, limit: number) {
  const name = matches(sql.raw("a.name"), q);
  const inner = sql`
    select a.id, a.name, ${name.starts} as starts, (${name.score})::float8 as score
    from artists a
    where ${name.where} and a.merged_into_id is null
    order by starts desc, score desc
    limit ${PRE_CUT}
  `;
  // An artist's listeners: members who listened to one of its releases.
  const pop = sql`select count(distinct u.user_id) from release_artists ra
    join user_item_state u on u.release_id = ra.release_id
    where ra.artist_id = s.id and u.listened`;
  return ranked(inner, pop, sql`p.name`, limit);
}

export function rankedTracks(q: string, limit: number) {
  const title = matches(sql.raw("t.title"), q);
  const artist = matches(sql.raw("a.name"), q);
  const inner = sql`
    select t.id, t.title, ${title.starts} as starts,
      (${title.score} + 0.5 * coalesce(max(${artist.score}), 0))::float8 as score
    from tracks t
    left join track_artists ta on ta.track_id = t.id
    left join artists a on a.id = ta.artist_id
    where ${title.where} and t.merged_into_id is null
    group by t.id
    order by starts desc, score desc
    limit ${PRE_CUT}
  `;
  // A track's listeners: the track itself, or a release it is on.
  const pop = sql`select count(*) from (
    select u.user_id from user_item_state u where u.track_id = s.id and u.listened
    union
    select u.user_id from release_tracks rt
      join user_item_state u on u.release_id = rt.release_id
      where rt.track_id = s.id and u.listened
  ) l`;
  return ranked(inner, pop, sql`p.title`, limit);
}
