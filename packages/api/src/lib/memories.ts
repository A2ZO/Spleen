import { rowsOf, sql, type Db, type SQL } from "@spleen/db";
import { DEFAULT_TIME_ZONE, isTimeZone, todayIn, type ReleaseType } from "@spleen/validators";

import type {
  AnniversaryItem,
  ArtistRef,
  HomeMemories,
  MemoryRelease,
  ReleasedOnThisDay,
} from "../types";
import { mainReleaseSql, upcomingSql } from "./catalog/upcoming";
import { countsPublicly } from "./ratings";

/*
 * « Souvenirs » (milestone 14): computed at read time from dated listens and the current state,
 * nothing stored. Dates are compared to the list of the same day in past years, which serves
 * the existing indexes (no `extract` on an indexed column in a `where`).
 */

/** First year looked at (same floor as `LISTENED_ON_MIN` and `DISCOVERY_YEAR_MIN`). */
export const MEMORIES_FROM_YEAR = 1900;
/** « Il y a N ans, tu écoutais… »: at most this many records. */
export const MEMORIES_LISTENS_MAX = 6;
/** « Anniversaires du jour »: at most this many records. */
export const MEMORIES_ANNIVERSARIES_MAX = 6;
/** « Sortis un <jour mois> » (`/discover`): distinct members with a rating or a heart needed… */
export const RELEASED_ON_THIS_DAY_MIN_MEMBERS = 2;
/** …and at most this many records. */
export const RELEASED_ON_THIS_DAY_MAX = 6;
/** Round anniversaries, highlighted and listed first… */
export const ROUND_ANNIVERSARIES: readonly number[] = [10, 20, 25, 30, 40, 50, 75];
/** …and every decade after this one (60, 70, 80…). */
export const ROUND_EVERY_DECADE_FROM = 50;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * The same month and day as `today` (`YYYY-MM-DD`) in every year from `fromYear` to last year.
 * A 29 February only exists in leap years: it never comes back on the 28th or the 1st.
 */
export function sameDayInPastYears(today: string, fromYear = MEMORIES_FROM_YEAR): string[] {
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);
  const days: string[] = [];
  for (let y = fromYear; y < year; y++) {
    if (monthDay === "02-29" && !isLeapYear(y)) continue;
    days.push(`${String(y).padStart(4, "0")}-${monthDay}`);
  }
  return days;
}

/** 10, 20, 25, 30, 40, 50, then 60, 70… and 75 years. */
export function isRoundAnniversary(years: number): boolean {
  return (
    ROUND_ANNIVERSARIES.includes(years) || (years > ROUND_EVERY_DECADE_FROM && years % 10 === 0)
  );
}

/** `isRoundAnniversary` in SQL, built from the same constants (for the order). */
export function roundAnniversarySql(years: SQL): SQL {
  const list = sql.join(
    ROUND_ANNIVERSARIES.map((n) => sql`${n}::int`),
    sql`, `,
  );
  return sql`(${years} in (${list})
    or (${years} > ${ROUND_EVERY_DECADE_FROM}::int and ${years} % 10 = 0))`;
}

interface ReleaseRow {
  id: string;
  slug: string;
  title: string;
  type: ReleaseType;
  cover_url: string | null;
  year: number | null;
  artists: ArtistRef[] | string | null;
}

interface MemoryRow extends ReleaseRow {
  grp: "listens" | "anniversaries";
  rank: number | string;
  day: string | null;
  years: number | null;
}

/** The artists of `releases r`, in their order, as JSON (same shape as `ArtistRef`). */
const artistsJsonSql = sql`coalesce((
  select json_agg(json_build_object('slug', a.slug, 'name', a.name) order by ra.position)
  from release_artists ra
  join artists a on a.id = ra.artist_id
  where ra.release_id = r.id
), '[]'::json)`;

const dayListSql = (days: string[]) =>
  sql.join(
    days.map((d) => sql`${d}::date`),
    sql`, `,
  );

function toMemoryRelease(row: ReleaseRow): MemoryRelease {
  const artists = typeof row.artists === "string" ? JSON.parse(row.artists) : row.artists;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    year: row.year === null ? null : Number(row.year),
    coverUrl: row.cover_url,
    artists: (artists ?? []) as ArtistRef[],
  };
}

/**
 * The member's « Souvenirs » for their day (`timeZone`, Paris when refused), in one query:
 * the most recent past year with dated listens of records on this day, and the anniversaries
 * of the records they rated or hearted. Null when both are empty.
 */
export async function homeMemories(
  db: Db,
  member: { id: string; timeZone: string },
  now: Date,
): Promise<HomeMemories | null> {
  const today = todayIn(isTimeZone(member.timeZone) ? member.timeZone : DEFAULT_TIME_ZONE, now);
  const days = sameDayInPastYears(today);
  if (days.length === 0) return null;
  const year = Number(today.slice(0, 4));
  const dayList = dayListSql(days);

  const rows = rowsOf<MemoryRow>(
    await db.execute(sql`
      with listened as (
        select e.release_id, e.listened_on, e.created_at
        from entries e
        join releases r on r.id = e.release_id
        where e.user_id = ${member.id}
          and e.release_id is not null
          and e.listened_on in (${dayList})
          and r.merged_into_id is null
          and not coalesce(${upcomingSql(today, false)}, false)
      ),
      picked as (
        (select 'listens'::text as grp,
            row_number() over (order by max(l.created_at) desc, l.release_id) as rank,
            l.listened_on::text as day, null::int as years, l.release_id as id
          from listened l
          where l.listened_on = (select max(listened_on) from listened)
          group by l.release_id, l.listened_on
          order by rank
          limit ${MEMORIES_LISTENS_MAX})
        union all
        (select 'anniversaries'::text as grp,
            row_number() over (order by y.round desc, y.years desc, y.title, y.id) as rank,
            null::text as day, y.years, y.id
          from (
            select x.*, ${roundAnniversarySql(sql`x.years`)} as round
            from (
              select r.id, r.title, ${year}::int - extract(year from r.release_date)::int as years
              from user_item_state s
              join releases r on r.id = s.release_id
              where s.user_id = ${member.id}
                and s.release_id is not null
                and (s.rating is not null or s.liked)
                and ${mainReleaseSql()}
                and r.release_date_precision = 'day'
                and r.release_date in (${dayList})
            ) x
          ) y
          order by rank
          limit ${MEMORIES_ANNIVERSARIES_MAX})
      )
      select p.grp, p.rank, p.day, p.years, r.id, r.slug, r.title, r.type, r.cover_url,
        extract(year from r.release_date)::int as year,
        ${artistsJsonSql} as artists
      from picked p
      join releases r on r.id = p.id
    `),
  );

  // `union all` keeps no order: sort by group, then by each group's rank.
  const sorted = [...rows].sort((a, b) => Number(a.rank) - Number(b.rank));
  const listenRows = sorted.filter((r) => r.grp === "listens");
  const anniversaries: AnniversaryItem[] = sorted
    .filter((r) => r.grp === "anniversaries")
    .map((r) => ({
      release: toMemoryRelease(r),
      years: Number(r.years),
      round: isRoundAnniversary(Number(r.years)),
    }));
  const day = listenRows[0]?.day ?? null;
  const listens =
    day === null
      ? null
      : {
          day,
          yearsAgo: year - Number(day.slice(0, 4)),
          releases: listenRows.map(toMemoryRelease),
        };
  if (!listens && anniversaries.length === 0) return null;
  return { today, listens, anniversaries };
}

interface ReleasedOnThisDayRow extends ReleaseRow {
  years: number | string;
}

/**
 * « Sortis un <jour mois> » on `/discover`: main, unmerged records released on Paris's day in a
 * past year, to the day, that at least `RELEASED_ON_THIS_DAY_MIN_MEMBERS` members rated or
 * hearted (current state; suspended accounts left out, private diaries counted as in the
 * averages, blocks ignored as in the trends). Nothing about the reader: the same for everyone.
 * One query, from the release dates (index) to each record's states (index by release).
 */
export async function releasedOnThisDay(db: Db, now: Date): Promise<ReleasedOnThisDay> {
  const day = todayIn(DEFAULT_TIME_ZONE, now);
  const days = sameDayInPastYears(day);
  if (days.length === 0) return { day, items: [] };
  const year = Number(day.slice(0, 4));

  const rows = rowsOf<ReleasedOnThisDayRow>(
    await db.execute(sql`
      select r.id, r.slug, r.title, r.type, r.cover_url,
        extract(year from r.release_date)::int as year,
        ${year}::int - extract(year from r.release_date)::int as years,
        ${artistsJsonSql} as artists
      from (
        select r.id, count(distinct s.user_id) as members
        from releases r
        join user_item_state s on s.release_id = r.id
          and (s.rating is not null or s.liked)
          and ${countsPublicly(sql`s.user_id`)}
        where r.release_date in (${dayListSql(days)})
          and r.release_date_precision = 'day'
          and ${mainReleaseSql()}
        group by r.id
        having count(distinct s.user_id) >= ${RELEASED_ON_THIS_DAY_MIN_MEMBERS}
      ) m
      join releases r on r.id = m.id
      order by m.members desc, r.release_date asc, r.title, r.id
      limit ${RELEASED_ON_THIS_DAY_MAX}
    `),
  );

  return {
    day,
    items: rows.map((r) => ({
      release: toMemoryRelease(r),
      years: Number(r.years),
      round: isRoundAnniversary(Number(r.years)),
    })),
  };
}
