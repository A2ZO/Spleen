import { z } from "zod";

import { timeZoneSchema } from "./listening";

/** @username: 3-30 chars, lowercase letters, digits, underscores and dots (not leading/trailing). */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_](?:[a-z0-9_.]*[a-z0-9_])?$/)
  .refine((value) => !value.includes(".."));

/**
 * Usernames nobody may take: words that look official or could collide with routes or
 * future features. Compared after normalisation (lowercase, dots and underscores removed).
 */
const RESERVED_USERNAMES = new Set([
  "about",
  "account",
  "admin",
  "administrator",
  "album",
  "api",
  "app",
  "artist",
  "auth",
  "blog",
  "contact",
  "diary",
  "discover",
  "help",
  "home",
  "legal",
  "list",
  "lists",
  "login",
  "logout",
  "me",
  "moderator",
  "news",
  "notifications",
  "null",
  "official",
  "privacy",
  "root",
  "search",
  "settings",
  "signin",
  "signout",
  "signup",
  "spleen",
  "spleenplus",
  "staff",
  "support",
  "system",
  "team",
  "terms",
  "track",
  "undefined",
  "user",
  "welcome",
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase().replace(/[._]/g, ""));
}

export const displayNameSchema = z.string().trim().min(1).max(50);
export const bioSchema = z.string().trim().max(300);

export const localeSchema = z.enum(["fr", "en"]);
export const themeSchema = z.enum(["dark", "light"]);

/**
 * Version of the terms of use a new member accepts (the date of their last change). Bump it
 * when the terms change: members whose `terms_version` differs are to be asked again.
 */
export const TERMS_VERSION = "2026-10-27";

/**
 * First visit after signing in: pick a @username, and one box for both the minimum age (15)
 * and the terms of use. Magic link, code and Google all end here.
 */
export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  termsAccepted: z.literal(true),
  locale: localeSchema,
  theme: themeSchema,
  /** Detected by the browser; the default zone is kept when missing or unknown. */
  timeZone: timeZoneSchema.optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema,
  locale: localeSchema,
  theme: themeSchema,
  statsPrivate: z.boolean(),
  diaryPrivate: z.boolean(),
  blindMode: z.boolean(),
  timeZone: timeZoneSchema,
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** Deleting the account requires typing one's @username. */
export const deleteAccountSchema = z.object({ confirmUsername: z.string().trim().min(1) });

export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_SIZE_PX = 512;

/** The Shelf: 4 favourite records (any release type), positions 1..4. */
export const SHELF_SIZE = 4;
export const shelfPositionSchema = z.number().int().min(1).max(SHELF_SIZE);
/** Puts a release in a slot; a release already on the Shelf moves there (no duplicates). */
export const shelfSetSchema = z.object({ releaseId: z.uuid(), position: shelfPositionSchema });
export const shelfRemoveSchema = z.object({ position: shelfPositionSchema });
/** New order of the records on the Shelf, slot 1 first (null = empty slot). */
export const shelfReorderSchema = z.object({
  releaseIds: z.array(z.uuid().nullable()).length(SHELF_SIZE),
});

/** Paginated profile sections; pages start at 1. */
export const pageNumberSchema = z.number().int().min(1).max(10_000);
/** A calendar month, "2026-10". */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const profilePageSchema = z.object({ username: usernameSchema, page: pageNumberSchema });
export const profileMonthSchema = z.object({ username: usernameSchema, month: monthSchema });
