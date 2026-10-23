/* Calendar month arithmetic on "YYYY-MM" strings (UTC, no time zone involved). */

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
