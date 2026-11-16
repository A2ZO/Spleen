import { MAIN_SECONDARY_TYPES, type DatePrecision } from "@spleen/catalog";
import { rowsOf, sql, type Db, type DbOrTx, type SQL } from "@spleen/db";
import { DEFAULT_TIME_ZONE, todayIn, type ReleaseType } from "@spleen/validators";

import { fail } from "../../trpc";
import type { ReleaseCard, UpcomingGroup, UpcomingItem, UpcomingSuggestions } from "../../types";
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

/** Not merged and a main release (secondary types limited to MAIN_SECONDARY_TYPES). */
export function mainReleaseSql(): SQL {
  return sql`r.merged_into_id is null
    and r.secondary_types <@ array[${sql.join(
      MAIN_SECONDARY_TYPES.map((t) => sql`${t}`),
      sql`, `,
    )}]::text[]`;
}

/** The date part of the rule, on alias `r`, for `today` (`YYYY-MM-DD`). */
export function upcomingDateSql(today: string): SQL {
  const t = sql`${today}::date`;
  return sql`(
    (r.release_date_precision = 'day'
      and r.release_date > ${t}
      and r.release_date <= ${t} + interval '12 months')
    or (r.release_date_precision = 'month'
      and (date_trunc('month', r.release_date) > date_trunc('month', ${t})
        or (date_trunc('month', r.release_date) = date_trunc('month', ${t})
          and r.announced_at is not null))
      and r.release_date <= ${t} + interval '12 months')
    or (r.release_date_precision = 'year'
      and (extract(year from r.release_date) = extract(year from ${t}) + 1
        or (extract(year from r.release_date) = extract(year from ${t})
          and r.announced_at is not null)))
  )`;
}

/** The whole rule, on alias `r`. */
export function upcomingSql(today: string): SQL {
  return sql`(${mainReleaseSql()} and ${upcomingDateSql(today)})`;
}

/** The release when the rule calls it upcoming for `today`, else null. */
export async function upcomingRelease(
  db: DbOrTx,
  releaseId: string,
  today: string,
): Promise<{ dateChanged: boolean } | null> {
  const [row] = rowsOf<{ changed: boolean }>(
    await db.execute(sql`
      select r.release_date_changed_at is not null as changed
      from releases r where r.id = ${releaseId} and ${upcomingSql(today)}
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

async function toItems(
  db: Db,
  viewer: Viewer,
  rows: UpcomingRow[],
  today: string,
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
  if (viewer.id && cards.size > 0) {
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
      and exists (
        select 1 from release_artists ra
        join artist_follows af on af.artist_id = ra.artist_id
        where ra.release_id = r.id and af.user_id = ${userId}
      )
    order by r.release_date, r.title, r.id
    limit ${UPCOMING_MINE_MAX}
  `);
  return toItems(db, viewer, rowsOf<UpcomingRow>(result), today);
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
