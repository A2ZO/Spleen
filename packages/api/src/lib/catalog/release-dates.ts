import type { DatePrecision, PartialDate } from "@spleen/catalog";
import { schema, sql, type SQL } from "@spleen/db";

/*
 * Date tracking of releases (milestone 11, docs/catalogue.md « Dates annoncées »):
 * - `announced_at`: set the first time a release is written with a date whose first day (a
 *   month or a year is stored on its first day) is after the UTC day of the import; never
 *   rewritten;
 * - `release_date_changed_at`: set when the date of an announced release moves out of its
 *   previous period, compared at the coarser precision of the two ("2027" → "2027-03-14" adds
 *   precision, it does not change the date).
 * MusicBrainz is the only source of dates: ListenBrainz only tells which groups to re-read.
 */

const { releases } = schema;

/** UTC calendar day of `at`, `YYYY-MM-DD`. */
export const utcDay = (at: Date) => at.toISOString().slice(0, 10);

/** `announced_at` of a release inserted now with this date. */
export function announcedAtFor(date: PartialDate | null | undefined, now: Date): Date | null {
  return date && date.date > utcDay(now) ? now : null;
}

/**
 * Date columns for an UPDATE of `releases`: the new date and precision, with the two tracking
 * columns computed from the row's previous values (SET reads the old row).
 */
export function trackedDateSet(date: PartialDate | null | undefined, now: Date) {
  const newDate = date?.date ?? null;
  const newPrecision: DatePrecision | null = date?.precision ?? null;
  const at = now.toISOString();
  const moved = movedOutOfPeriod(newDate, newPrecision);
  return {
    releaseDate: newDate,
    releaseDatePrecision: newPrecision,
    announcedAt: sql`coalesce(${releases.announcedAt},
      case when ${newDate}::date > ${utcDay(now)}::date then ${at}::timestamptz end)`,
    releaseDateChangedAt: sql`case
      when ${releases.announcedAt} is not null and ${moved} then ${at}::timestamptz
      else ${releases.releaseDateChangedAt} end`,
  };
}

/** True when the new date lies outside the period of the stored one (both known). */
function movedOutOfPeriod(newDate: string | null, newPrecision: DatePrecision | null): SQL {
  if (!newDate) return sql`false`;
  const unit = sql`case
    when ${releases.releaseDatePrecision} = 'year' or ${newPrecision}::date_precision = 'year'
      then 'year'
    when ${releases.releaseDatePrecision} = 'month' or ${newPrecision}::date_precision = 'month'
      then 'month'
    else 'day' end`;
  return sql`(${releases.releaseDate} is not null
    and date_trunc(${unit}, ${releases.releaseDate}::timestamp)
      <> date_trunc(${unit}, ${newDate}::date::timestamp))`;
}

/**
 * Rows whose date a discography re-read may update: announced ones, or whose stored or new
 * date is after today. Past dates are never rewritten (recent releases, stats by decade).
 */
export function mayUpdateDate(date: PartialDate | null | undefined, now: Date): SQL {
  const today = utcDay(now);
  return sql`(${releases.announcedAt} is not null
    or ${releases.releaseDate} > ${today}::date
    or ${date?.date ?? null}::date > ${today}::date)`;
}
