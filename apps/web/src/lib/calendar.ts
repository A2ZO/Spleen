/* Calendar month arithmetic on "YYYY-MM" strings (UTC, no time zone involved). */

import { DEFAULT_TIME_ZONE, monthIn } from "@spleen/validators";

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** Cells of a month grid: leading nulls up to the first weekday, then each "YYYY-MM-DD". */
export function monthGrid(month: string, weekStartsOn: 0 | 1): (string | null)[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const offset = (firstWeekday - weekStartsOn + 7) % 7;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * The current calendar month, "YYYY-MM", as the diary and the home page count it: in the
 * viewer's time zone (`profiles.time_zone`, the zone their listens are dated in), Europe/Paris
 * for a visitor. One source for both pages.
 */
export function currentMonth(timeZone: string | null | undefined, now: Date = new Date()): string {
  return monthIn(timeZone ?? DEFAULT_TIME_ZONE, now);
}

/** Every day of a month, "YYYY-MM-DD", first to last. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
