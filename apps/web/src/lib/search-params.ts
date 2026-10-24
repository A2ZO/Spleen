import { monthSchema, pageNumberSchema } from "@spleen/validators";

export type SearchParams = Record<string, string | string[] | undefined>;

export const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** `?page=` as a page number (1 when missing or invalid). */
export function pageParam(value: string | string[] | undefined): number {
  const parsed = pageNumberSchema.safeParse(Number(firstParam(value)));
  return parsed.success ? parsed.data : 1;
}

/** `?month=2026-10`, or null when missing or invalid. */
export function monthParam(value: string | string[] | undefined): string | null {
  const parsed = monthSchema.safeParse(firstParam(value));
  return parsed.success ? parsed.data : null;
}

/** Builds `path?key=value…`, leaving out empty values (and `page=1`). */
export function hrefWith(path: string, params: Record<string, string | number | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === "" || (key === "page" && value === 1)) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
