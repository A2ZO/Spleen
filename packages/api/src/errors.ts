/**
 * Stable error codes carried in `TRPCError.message`. Clients map them to translated text
 * (`errors.<code>` in packages/i18n), so they must never change meaning.
 */
export const API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "PROFILE_REQUIRED",
  "PROFILE_EXISTS",
  "USERNAME_INVALID",
  "USERNAME_RESERVED",
  "USERNAME_TAKEN",
  "USERNAME_COOLDOWN",
  "USERNAME_UNCHANGED",
  "AVATAR_TOO_LARGE",
  "AVATAR_TYPE",
  "RATE_LIMITED",
  "CONFIRMATION_MISMATCH",
  "CATALOG_BUSY",
  "CATALOG_UNAVAILABLE",
  "CATALOG_NOT_FOUND",
  "ITEM_NOT_FOUND",
  "ENTRY_NOT_FOUND",
  "REVIEW_NOT_FOUND",
  "MOOD_NOT_FOUND",
  "MOOD_LIMIT",
  "TRACK_NOT_ON_RELEASE",
  "DATE_IN_FUTURE",
  "DATE_REQUIRED",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return API_ERROR_CODES.includes(value as ApiErrorCode);
}
