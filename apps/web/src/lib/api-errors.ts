import { isApiErrorCode, type ApiErrorCode } from "@spleen/api/errors";

/** Stable API error code from an error thrown by `getApi()`, or "unknown". */
export function errorCode(error: unknown): ApiErrorCode | "unknown" {
  const message = (error as { message?: unknown })?.message;
  return isApiErrorCode(message) ? message : "unknown";
}

/**
 * Loads a cursor page. A stale or edited `?after=` (an old shared link) falls back to the
 * first page instead of the error page; the returned `cursor` is then undefined.
 */
export async function loadCursorPage<T>(
  cursor: string | undefined,
  load: (cursor: string | undefined) => Promise<T>,
): Promise<{ page: T; cursor: string | undefined }> {
  if (cursor) {
    try {
      return { page: await load(cursor), cursor };
    } catch (error) {
      if (errorCode(error) !== "INVALID_CURSOR") throw error;
    }
  }
  return { page: await load(undefined), cursor: undefined };
}
