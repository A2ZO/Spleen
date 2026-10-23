/*
 * Where the base stats read their data (all aggregated in SQL, see `base.ts`):
 * - listens are the member's rows in `entries` (artists are never "listened");
 * - counts: distinct albums, EPs and singles from release listens, distinct tracks from
 *   tracks logged on their own. Track ratings given inside an album listen do not count as
 *   listened tracks (the album listen is already counted);
 * - top artists (release and track credits), top genres (release genres) and activity per
 *   month count listens, relistens included; decades count release listens, by release year;
 * - per-year and per-month figures use `listened_on`, which is already a date in the member's
 *   time zone. "This year" is today's year in `profiles.time_zone` (`todayIn`);
 * - undated listens (`listened_on` null) count in all-time totals and decades only, never
 *   in per-year or per-month figures nor in the calendar;
 * - the rating distribution uses the current rating per release
 *   (`user_item_state.rating`, i.e. the most recently edited rated listen).
 */

/** Half-open range of `listened_on` dates for a calendar year: [start, end). */
export function yearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}
