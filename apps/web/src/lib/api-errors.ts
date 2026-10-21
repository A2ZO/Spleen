import { isApiErrorCode, type ApiErrorCode } from "@spleen/api/errors";

/** Stable API error code from an error thrown by `getApi()`, or "unknown". */
export function errorCode(error: unknown): ApiErrorCode | "unknown" {
  const message = (error as { message?: unknown })?.message;
  return isApiErrorCode(message) ? message : "unknown";
}
