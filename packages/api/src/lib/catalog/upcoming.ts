import { MAIN_SECONDARY_TYPES, type DatePrecision } from "@spleen/catalog";
import { rowsOf, sql, type Db, type DbOrTx, type SQL } from "@spleen/db";
import { DEFAULT_TIME_ZONE, todayIn, type ReleaseType } from "@spleen/validators";

import { fail } from "../../trpc";
import type {
  ReleaseCard,
  UpcomingGroup,
  UpcomingHome,
  UpcomingItem,
  UpcomingSuggestions,
} from "../../types";
import { loadReleaseCards, toReleaseCard } from "./cards";
import { maskRelease, ratedIds } from "../listening/blind";
import { getMemberStats } from "../stats";
import type { Viewer } from "../viewer";

/*
 * Upcoming releases (milestone 11, docs/decouverte.md « Sorties à venir »), for the reader's
 * today (their profile's zone, Europe/Paris for a visitor):
 * - day precision: after today;
 * - month precision: a later month, or the current month when the release was announced
 *   (seen with that month before it began);
 * - year precision: a later year, or the current year when announced;
 * - never more than 12 months ahead (a year: the next one at most);
 * - not merged, a main release (no live, compilation…), album / EP / single.
 * Recent releases leave out what this rule calls upcoming.
 */

/** At most this many items in « Mes sorties à venir ». */
export const UPCOMING_MINE_MAX = 200;
/** At most this many items on an artist page. */
export const UPCOMING_ARTIST_MAX = 20;
/** « Cette semaine »: the next 7 days, today excluded. */
export const UPCOMING_WEEK_DAYS = 7;
/** Tiles of « Bientôt dans tes oreilles » on the home page. */
export const UPCOMING_HOME_MAX = 5;
/** The « Sort … » card of the home page: a day release at most this many days ahead. */
export const UPCOMING_SOON_DAYS = 6;
/** « Les plus attendus » on /discover: at most this many records… */
export const AWAITED_MAX = 10;
/** …each awaited by at least this many members. */
export const AWAITED_MIN_MEMBERS = 2;

/** Not merged and a main release (secondary types limited to MAIN_SECONDARY_TYPES). */
export function mainReleaseSql(): SQL {
  return sql`r.merged_into_id is null
    and r.secondary_types <@ array[${sql.join(
      MAIN_SECONDARY_TYPES.map((t) => sql`${t}`),
      sql`, `,
    )}]::text[]`;
}

/**
 * The date part of the rule, on alias `r`, for `today` (`YYYY-MM-DD`). `horizon: false` drops
 * the 12-month cap: « not out yet », for the record page and the refusals of `RELEASE_NOT_OUT`.
 */
export function upcomingDateSql(today: string, horizon = true): SQL {
  const t = sql`${today}::date`;
  const capped = horizon ? sql`r.release_date <= ${t} + interval '12 months'` : sql`true`;
  const nextYear = horizon
    ? sql`extract(year from r.release_date) = extract(year from ${t}) + 1`
    : sql`extract(year from r.release_date) > extract(year from ${t})`;
  return sql`(
    (r.release_date_precision = 'day'
      and r.release_date > ${t}
      and ${capped})
    or (r.release_date_precision = 'month'
      and (date_trunc('month', r.release_date) > date_trunc('month', ${t})
        or (date_trunc('month', r.release_date) = date_trunc('month', ${t})
          and r.announced_at is not null))
      and ${capped})
    or (r.release_date_precision = 'year'
      and (${nextYear}
        or (extract(year from r.release_date) = extract(year from ${t})
          and r.announced_at is not null)))
  )`;
}

/** The whole rule, on alias `r`. */
export function upcomingSql(today: string, horizon = true): SQL {
  return sql`(${mainReleaseSql()} and ${upcomingDateSql(today, horizon)})`;
}

/**
 * The release when it is not out yet for `today` (the rule without its 12-month cap: a record
 * dated in two years is not out either), else null.
 */
export async function upcomingRelease(
  db: DbOrTx,
  releaseId: string,
  today: string,
): Promise<{ dateChanged: boolean } | null> {
  const [row] = rowsOf<{ changed: boolean }>(
    await db.execute(sql`
      select r.release_date_changed_at is not null as changed
      from releases r where r.id = ${releaseId} and ${upcomingSql(today, false)}
    `),
  );
  return row ? { dateChanged: row.changed } : null;
}

const addDays = (day: string, days: number) => {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

/** Section of an upcoming release: this week, this month, later, or year only (« À préciser »). */
export function upcomingGroup(
  date: string,
  precision: DatePrecision,
  today: string,
): UpcomingGroup {
  if (precision === "year") return "tba";
  const sameMonth = date.slice(0, 7) === today.slice(0, 7);
  if (precision === "month") return sameMonth ? "month" : "later";
  if (date <= addDays(today, UPCOMING_WEEK_DAYS)) return "week";
  return sameMonth ? "month" : "later";
}

interface UpcomingRow {
  id: string;
  date: string;
  precision: DatePrecision;
  changed: boolean;
}

/**
 * Items for `rows`, in their order. `withQueue: false` skips the reader's « À écouter »
 * (tiles that show no button).
 */
async function toItems(
  db: Db,
  viewer: Viewer,
  rows: UpcomingRow[],
  today: string,
  withQueue = true,
): Promise<UpcomingItem[]> {
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.id),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const queued = new Set<string>();
  if (withQueue && viewer.id && cards.size > 0) {
    const rows = rowsOf<{ id: string }>(
      await db.execute(sql`
        select release_id as id from user_item_state
        where user_id = ${viewer.id} and want_to_listen
          and release_id in (${sql.join(
            [...cards.keys()].map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      `),
    );
    for (const r of rows) queued.add(r.id);
  }
  let mask = (card: ReleaseCard) => card;
  if (viewer.blind) {
    const rated = await ratedIds(db, viewer.blind.userId, "releaseId", [...cards.keys()]);
    mask = (card) => maskRelease(rated, card);
  }
  return rows.flatMap((row) => {
    const card = cards.get(row.id);
    if (!card) return [];
    return [
      {
        release: mask(card),
        date: row.date,
        precision: row.precision,
        dateChanged: row.changed,
        group: upcomingGroup(row.date, row.precision, today),
        wantToListen: queued.has(row.id),
      },
    ];
  });
}

const rowColumns = sql`r.id, to_char(r.release_date, 'YYYY-MM-DD') as date,
  r.release_date_precision as precision, r.release_date_changed_at is not null as changed`;

/** Followed by `userId`: one of the release's artists. */
const followedBy = (userId: string) => sql`exists (
  select 1 from release_artists ra
  join artist_follows af on af.artist_id = ra.artist_id
  where ra.release_id = r.id and af.user_id = ${userId}
)`;

/**
 * Upcoming releases of the artists the member follows, by date then title, in the member's
 * zone; one type or all three.
 */
export async function upcomingForMember(
  db: Db,
  viewer: Viewer,
  userId: string,
  timeZone: string | null | undefined,
  now: Date,
  type?: ReleaseType,
): Promise<UpcomingItem[]> {
  const today = todayIn(timeZone || DEFAULT_TIME_ZONE, now);
  const result = await db.execute(sql`
    select ${rowColumns}
    from releases r
    where ${upcomingSql(today)}
      and ${type ? sql`r.type = ${type}` : sql`true`}
      and ${followedBy(userId)}
    order by r.release_date, r.title, r.id
    limit ${UPCOMING_MINE_MAX}
  `);
  return toItems(db, viewer, rowsOf<UpcomingRow>(result), today);
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * The member's home page (in their zone): the next UPCOMING_HOME_MAX followed releases
 * (a year-only date is stored on January 1st: those come last), the first day release from
 * tomorrow to UPCOMING_SOON_DAYS ahead, and whether they follow anyone.
 */
export async function upcomingHome(
  db: Db,
  viewer: Viewer,
  userId: string,
  timeZone: string | null | undefined,
  now: Date,
): Promise<UpcomingHome> {
  const today = todayIn(timeZone || DEFAULT_TIME_ZONE, now);
  // One statement (the home page already fills the small pool): `following` on every row,
  // and one row with null columns when nothing is upcoming.
  const picked = rowsOf<{ following: boolean; pick: "next" | "soon" | null } & UpcomingRow>(
    await db.execute(sql`
      select f.following, p.id, p.date, p.precision, p.changed, p.pick
      from (
        select exists (select 1 from artist_follows where user_id = ${userId}) as following
      ) f
      left join lateral (
        (
          select ${rowColumns}, 'next' as pick, row_number() over (
            order by (r.release_date_precision = 'year'), r.release_date, r.title, r.id
          ) as ord
          from releases r
          where ${upcomingSql(today)} and ${followedBy(userId)}
          order by ord
          limit ${UPCOMING_HOME_MAX}
        )
        union all
        (
          select ${rowColumns}, 'soon' as pick, 0 as ord
          from releases r
          where ${upcomingSql(today)} and ${followedBy(userId)}
            and r.release_date_precision = 'day'
            and r.release_date <= ${addDays(today, UPCOMING_SOON_DAYS)}::date
          order by r.release_date, r.title, r.id
          limit 1
        )
      ) p on true
      order by p.pick, p.ord
    `),
  );
  const nextRows = picked.filter((r) => r.pick === "next");
  const soonRow = picked.find((r) => r.pick === "soon");
  // The soon release is often among the next ones: one card load for both.
  const rows =
    soonRow && !nextRows.some((r) => r.id === soonRow.id) ? [...nextRows, soonRow] : nextRows;
  const items = await toItems(db, viewer, rows, today, false);
  const soonItem = soonRow && items.find((i) => i.release.id === soonRow.id);
  return {
    following: picked[0]?.following ?? false,
    items: items.filter((i) => nextRows.some((r) => r.id === i.release.id)),
    soon: soonItem ? { item: soonItem, inDays: daysBetween(today, soonItem.date) } : null,
  };
}

/**
 * « Les plus attendus » (Paris day, the same for every reader: public cache, issue #22):
 * upcoming releases ranked by distinct members who follow one of their artists or have them
 * in « À écouter », AWAITED_MIN_MEMBERS at least, suspended members left out, every language;
 * ties go to the nearest date (year-only last). No member is named or counted in the result.
 */
export async function awaitedReleases(db: Db, now: Date): Promise<UpcomingItem[]> {
  const today = todayIn(DEFAULT_TIME_ZONE, now);
  const result = await db.execute(sql`
    with coming as (
      select ${rowColumns}, r.release_date as day, r.title
      from releases r where ${upcomingSql(today)}
    ),
    fans as (
      select c.id, af.user_id
      from coming c
      join release_artists ra on ra.release_id = c.id
      join artist_follows af on af.artist_id = ra.artist_id
      union
      select c.id, s.user_id
      from coming c
      join user_item_state s on s.release_id = c.id and s.want_to_listen
    )
    select c.id, c.date, c.precision, c.changed
    from coming c
    join fans f on f.id = c.id
    join profiles p on p.user_id = f.user_id and p.suspended_at is null
    group by c.id, c.date, c.precision, c.changed, c.day, c.title
    having count(distinct f.user_id) >= ${AWAITED_MIN_MEMBERS}
    order by count(distinct f.user_id) desc, (c.precision = 'year'), c.day, c.title, c.id
    limit ${AWAITED_MAX}
  `);
  return toItems(db, { id: null, blind: null }, rowsOf<UpcomingRow>(result), today, false);
}

/**
 * Upcoming releases of one artist (a merged artist's slug reads the page kept), the same for
 * every reader (public cache, issue #22): Paris day, no blind masking. Unknown → NOT_FOUND.
 */
export async function upcomingByArtist(db: Db, slug: string, now: Date): Promise<UpcomingItem[]> {
  const [artist] = rowsOf<{ id: string }>(
    await db.execute(sql`
      select coalesce(a.merged_into_id, a.id) as id from artists a where a.slug = ${slug}
    `),
  );
  if (!artist) fail("NOT_FOUND", "ITEM_NOT_FOUND");
  const today = todayIn(DEFAULT_TIME_ZONE, now);
  const result = await db.execute(sql`
    select ${rowColumns}
    from releases r
    where ${upcomingSql(today)}
      and exists (
        select 1 from release_artists ra where ra.release_id = r.id and ra.artist_id = ${artist.id}
      )
    order by r.release_date, r.title, r.id
    limit ${UPCOMING_ARTIST_MAX}
  `);
  return toItems(db, { id: null, blind: null }, rowsOf<UpcomingRow>(result), today);
}

/** Suggested artists at most (the profile's top artists of the year: five). */
const SUGGESTIONS_MAX = 5;

/**
 * How many artists the member follows, and their top artists of the year (profile stats, cached)
 * not followed yet, in the stats order; a merged artist's slug gives the artist kept.
 */
export async function upcomingSuggestions(
  db: Db,
  userId: string,
  now: Date,
): Promise<UpcomingSuggestions> {
  const [stats, counted] = await Promise.all([
    getMemberStats(db, userId, now),
    db.execute(sql`select count(*)::int as n from artist_follows where user_id = ${userId}`),
  ]);
  const following = rowsOf<{ n: number }>(counted)[0]?.n ?? 0;
  const slugs = (stats?.base.topArtists ?? []).map((a) => a.slug);
  if (slugs.length === 0) return { following, artists: [] };
  const list = sql.join(
    slugs.map((slug) => sql`${slug}`),
    sql`, `,
  );
  const rows = rowsOf<{ id: string; slug: string; name: string }>(
    await db.execute(sql`
      select kept.id, kept.slug, kept.name
      from artists a join artists kept on kept.id = coalesce(a.merged_into_id, a.id)
      where a.slug in (${list})
        and not exists (
          select 1 from artist_follows af where af.user_id = ${userId} and af.artist_id = kept.id
        )
      group by kept.id, kept.slug, kept.name
      order by min(array_position(array[${list}]::text[], a.slug::text))
      limit ${SUGGESTIONS_MAX}
    `),
  );
  return { following, artists: rows.map(({ id, slug, name }) => ({ id, slug, name })) };
}
