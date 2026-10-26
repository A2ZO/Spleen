/** Rows of a raw `db.execute()` result: postgres.js returns an array, PGlite `{ rows }`. */
export const rowsOf = <T>(result: unknown): T[] =>
  (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
