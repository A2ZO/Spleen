import { MAIN_SECONDARY_TYPES } from "@spleen/catalog";
import { rowsOf, schema, sql, type Db, type SQL } from "@spleen/db";
import type { AudienceLang, ReleaseType, TopRatedInput } from "@spleen/validators";

import type {
  GenreOption,
  Page,
  ReleaseCard,
  TopRatedItem,
  TopRatedPage,
  TrendItem,
} from "../types";
import { loadReleaseCards, toReleaseCard } from "./catalog/cards";
import { maskRelease, ratedIds } from "./listening/blind";
import { countsPublicly } from "./ratings";
import type { Viewer } from "./viewer";

/*
 * Discovery: weekly trends by audience language, recent releases and top rated charts.
 * Every chart is an anonymous aggregate (no member is shown), so blocks do not filter it;
 * private diaries never count in trends, suspended members in no chart; ratings follow the
 * viewer's blind listening.
 * Rules and their reasons: docs/decouverte.md.
 */

const { genres } = schema;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trends: listens logged in the last 7 days. */
export const TREND_WINDOW_DAYS = 7;
/** When even all languages give too few records in a week, the window widens to 30 days. */
export const TREND_FALLBACK_DAYS = 30;
/** A record needs this many distinct members: one listener alone would be exposed. */
export const TREND_MIN_MEMBERS = 2;
export const TREND_SIZE = 10;
/** Below this many records, the language chart is completed (all languages, then 30 days). */
export const TREND_MIN_FILLED = 5;

/** Recent releases: out in the last 90 days. */
export const RECENT_DAYS = 90;
export const RECENT_PAGE_SIZE = 24;

/**
 * Top rated: minimum number of ratings to enter a chart, and weight of the site average in
 * the Bayesian score. Raise it as the community grows (docs/decouverte.md).
 */
export const DISCOVERY_MIN_RATINGS = 3;
export const TOP_RATED_PAGE_SIZE = 25;

const iso = (date: Date) => date.toISOString();
const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** Masks the community ratings of the cards the blind viewer has not rated. */
async function masker(db: Db, viewer: Viewer, cards: ReleaseCard[]) {
  if (!viewer.blind) return (card: ReleaseCard) => card;
  const rated = await ratedIds(
    db,
    viewer.blind.userId,
    "releaseId",
    cards.map((c) => c.id),
  );
  return (card: ReleaseCard) => maskRelease(rated, card);
}

async function releaseCards(db: Db, ids: string[]): Promise<Map<string, ReleaseCard>> {
  const cards = await loadReleaseCards(db, ids);
  return new Map(cards.map((c) => [c.id, toReleaseCard(c)]));
}

/* ---------------------------------------------------------------- trends */

interface TrendRow {
  id: string;
  listeners: number;
}

/**
 * Releases most listened to by distinct members since `since` (up to `now`), among members
 * of one interface language or all of them. A listen counts when it is logged: dated
 * listens by creation, undated ones (quick ratings and hearts) by their last change.
 */
async function trendRows(
  db: Db,
  lang: AudienceLang | null,
  since: Date,
  now: Date,
  limit: number,
): Promise<TrendRow[]> {
  const activeSince = (column: SQL) =>
    sql`${column} >= ${iso(since)}::timestamptz and ${column} <= ${iso(now)}::timestamptz`;
  const result = await db.execute(sql`
    select e.release_id as id, count(distinct e.user_id)::int as listeners
    from entries e
    join profiles p on p.user_id = e.user_id
    where e.release_id is not null
      and not p.diary_private
      and p.suspended_at is null
      and ${lang ? sql`p.locale = ${lang}` : sql`true`}
      and (
        (e.listened_on is not null and ${activeSince(sql`e.created_at`)})
        or (e.listened_on is null and ${activeSince(sql`e.updated_at`)})
      )
    group by e.release_id
    having count(distinct e.user_id) >= ${TREND_MIN_MEMBERS}
    order by
      listeners desc,
      count(distinct e.user_id) filter (where e.liked) desc,
      max(case when e.listened_on is null then e.updated_at else e.created_at end) desc,
      e.release_id
    limit ${limit}
  `);
  return rowsOf<TrendRow>(result);
}

/**
 * The week's trends with members using the interface in `lang`. A short chart (fewer than
 * TREND_MIN_FILLED records) is completed with the week in all languages, then with the last
 * 30 days in all languages; each item says where it comes from.
 */
export async function weeklyTrends(
  db: Db,
  lang: AudienceLang,
  viewer: Viewer,
  now: Date,
  size = TREND_SIZE,
): Promise<TrendItem[]> {
  const week = new Date(now.getTime() - TREND_WINDOW_DAYS * DAY_MS);
  const month = new Date(now.getTime() - TREND_FALLBACK_DAYS * DAY_MS);
  const stages: [TrendItem["source"], AudienceLang | null, Date][] = [
    ["lang", lang, week],
    ["all", null, week],
    ["month", null, month],
  ];
  const picked: (TrendRow & { source: TrendItem["source"] })[] = [];
  for (const [source, stageLang, since] of stages) {
    if (picked.length >= Math.min(size, TREND_MIN_FILLED) && source !== "lang") break;
    const rows = await trendRows(db, stageLang, since, now, size + picked.length);
    for (const row of rows) {
      if (picked.length >= size) break;
      if (!picked.some((p) => p.id === row.id)) picked.push({ ...row, source });
    }
  }
  const cards = await releaseCards(
    db,
    picked.map((p) => p.id),
  );
  const mask = await masker(db, viewer, [...cards.values()]);
  return picked.flatMap((p) => {
    const card = cards.get(p.id);
    return card ? [{ release: mask(card), listeners: p.listeners, source: p.source }] : [];
  });
}

/* ---------------------------------------------------------------- recent releases */

/** Studio releases (no live, compilation…) out in the last RECENT_DAYS days, newest first. */
export async function recentReleases(
  db: Db,
  viewer: Viewer,
  now: Date,
  type: ReleaseType | undefined,
  page: number,
): Promise<Page<ReleaseCard>> {
  const types: ReleaseType[] = type ? [type] : ["album", "ep"];
  const where = sql`
    r.release_date between ${dayOf(new Date(now.getTime() - RECENT_DAYS * DAY_MS))}::date
      and ${dayOf(now)}::date
    and r.release_date_precision in ('day', 'month')
    and r.type in (${sql.join(
      types.map((t) => sql`${t}`),
      sql`, `,
    )})
    and r.secondary_types <@ array[${sql.join(
      MAIN_SECONDARY_TYPES.map((t) => sql`${t}`),
      sql`, `,
    )}]::text[]`;
  const [ids, [total]] = await Promise.all([
    db
      .execute(
        sql`select r.id from releases r where ${where}
          order by r.release_date desc, r.id
          limit ${RECENT_PAGE_SIZE} offset ${(page - 1) * RECENT_PAGE_SIZE}`,
      )
      .then((r) => rowsOf<{ id: string }>(r).map((row) => row.id)),
    db
      .execute(sql`select count(*)::int as total from releases r where ${where}`)
      .then((r) => rowsOf<{ total: number }>(r)),
  ]);
  const cards = await releaseCards(db, ids);
  const mask = await masker(db, viewer, [...cards.values()]);
  const count = total?.total ?? 0;
  return {
    items: ids.flatMap((id) => {
      const card = cards.get(id);
      return card ? [mask(card)] : [];
    }),
    page,
    pageCount: Math.max(1, Math.ceil(count / RECENT_PAGE_SIZE)),
    total: count,
  };
}

/* ---------------------------------------------------------------- top rated */

/**
 * Bayesian average on the 1..10 scale: (v × R + m × C) / (v + m), with v the record's number
 * of ratings, R its average, C the average of every rating on the site and m the minimum
 * number of ratings. A record rated 10 by one member stays near the site average; a record
 * rated 9 by many members rises above it.
 */
export function bayesianScore(
  count: number,
  average: number,
  siteAverage: number,
  minRatings = DISCOVERY_MIN_RATINGS,
): number {
  return (count * average + minRatings * siteAverage) / (count + minRatings);
}

/**
 * Releases of one type with at least DISCOVERY_MIN_RATINGS ratings (members' current
 * ratings, as on the album page), ranked by Bayesian score; optionally of one genre and one
 * year or decade.
 */
export async function topRated(
  db: Db,
  viewer: Viewer,
  input: TopRatedInput,
): Promise<TopRatedPage> {
  const m = DISCOVERY_MIN_RATINGS;
  const from = input.decade ?? input.year;
  const to = input.decade !== undefined ? input.decade + 9 : input.year;
  const filters = sql`
    r.type = ${input.type}
    ${input.genre ? sql`and exists (select 1 from release_genres rg join genres g on g.id = rg.genre_id where rg.release_id = r.id and g.slug = ${input.genre})` : sql``}
    ${from !== undefined ? sql`and extract(year from r.release_date)::int between ${from} and ${to}` : sql``}`;
  const result = await db.execute(sql`
    with site as (
      select coalesce(avg(u.rating), 0)::float8 as c
      from user_item_state u
      where u.release_id is not null and u.rating is not null and ${countsPublicly(sql`u.user_id`)}
    ),
    rated as (
      select s.release_id as id, count(*)::int as v, avg(s.rating)::float8 as r
      from user_item_state s
      where s.release_id is not null and s.rating is not null and ${countsPublicly(sql`s.user_id`)}
      group by s.release_id
      having count(*) >= ${m}
    )
    select rated.id, rated.v, rated.r,
      ((rated.v * rated.r + ${m} * site.c) / (rated.v + ${m}))::float8 as score,
      count(*) over ()::int as total
    from rated
    cross join site
    join releases r on r.id = rated.id
    where ${filters}
    order by score desc, rated.v desc, rated.id
    limit ${TOP_RATED_PAGE_SIZE} offset ${(input.page - 1) * TOP_RATED_PAGE_SIZE}
  `);
  const rows = rowsOf<{ id: string; v: number; r: number; score: number; total: number }>(result);
  const cards = await releaseCards(
    db,
    rows.map((r) => r.id),
  );
  const mask = await masker(db, viewer, [...cards.values()]);
  const total = rows[0]?.total ?? 0;
  const offset = (input.page - 1) * TOP_RATED_PAGE_SIZE;
  return {
    items: rows.flatMap((row, index): TopRatedItem[] => {
      const card = cards.get(row.id);
      if (!card) return [];
      const release = mask(card);
      const score = release.ratingsHidden ? null : Number(row.score.toFixed(2));
      return [{ rank: offset + index + 1, release, score }];
    }),
    page: input.page,
    pageCount: Math.max(1, Math.ceil(total / TOP_RATED_PAGE_SIZE)),
    total,
    minRatings: m,
  };
}

/** Genres that have at least one release, for the chart filters (alphabetical). */
export async function genreOptions(db: Db): Promise<GenreOption[]> {
  return db
    .select({ slug: genres.slug, name: genres.name })
    .from(genres)
    .where(
      sql`exists (select 1 from "release_genres" where "release_genres"."genre_id" = "genres"."id")`,
    )
    .orderBy(sql`lower(${genres.name})`);
}
