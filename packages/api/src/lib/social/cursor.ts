import { fail } from "../../trpc";

/*
 * Opaque cursors for keyset pagination. Timestamps travel as Postgres text
 * (`created_at::text`, microseconds and offset included) so that comparing them back with
 * `::timestamptz` is exact: a JS Date would drop the microseconds and skip or repeat rows.
 */

export function encodeCursor(parts: (string | number)[]): string {
  return Buffer.from(JSON.stringify(parts), "utf8").toString("base64url");
}

/** The `size` parts of a cursor (strings), or INVALID_CURSOR. */
export function decodeCursor(cursor: string, size: number): string[] {
  try {
    const parts: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(parts) &&
      parts.length === size &&
      parts.every((p) => typeof p === "string" || typeof p === "number")
    ) {
      return parts.map(String);
    }
  } catch {
    // Falls through to the error below.
  }
  return fail("BAD_REQUEST", "INVALID_CURSOR");
}

/** Splits `limit + 1` rows into a page and tells whether another page follows. */
export function pageOf<T>(rows: T[], limit: number, cursorOf: (last: T) => string) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? cursorOf(last) : null };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid part of a cursor (a forged cursor must not reach SQL as a bad uuid). */
export function cursorUuid(value: string): string {
  if (!UUID.test(value)) fail("BAD_REQUEST", "INVALID_CURSOR");
  return value;
}

const PG_TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?$/;

/** A timestamp part of a cursor (`timestamptz::text`). */
export function cursorTime(value: string): string {
  if (!PG_TIMESTAMPTZ.test(value)) fail("BAD_REQUEST", "INVALID_CURSOR");
  return value;
}
