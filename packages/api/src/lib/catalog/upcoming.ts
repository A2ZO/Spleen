import { MAIN_SECONDARY_TYPES, type DatePrecision } from "@spleen/catalog";
import { rowsOf, sql, type Db, type SQL } from "@spleen/db";
import { DEFAULT_TIME_ZONE, todayIn, type ReleaseType } from "@spleen/validators";

import { fail } from "../../trpc";
import type { ReleaseCard, UpcomingGroup, UpcomingItem } from "../../types";
import { loadReleaseCards, toReleaseCard } from "./cards";
import { maskRelease, ratedIds } from "../listening/blind";
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
