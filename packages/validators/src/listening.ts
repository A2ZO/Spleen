import { z } from "zod";

import { audienceLangSchema, listenFormatSchema } from "./catalog";
import { RATING_MAX, RATING_MIN, ratingSchema } from "./rating";

/** What a member listens to: an album/EP/single or a track. */
export const listenTargetSchema = z.object({
  kind: z.enum(["release", "track"]),
  id: z.uuid(),
});
export type ListenTargetInput = z.infer<typeof listenTargetSchema>;

/** Earliest listening date accepted (anything older is a typo). */
export const LISTENED_ON_MIN = "1900-01-01";
export const listenedOnSchema = z.iso.date().refine((d) => d >= LISTENED_ON_MIN);

export const MOODS_PER_ENTRY_MAX = 8;
export const PERSONAL_MOODS_MAX = 50;
export const REVIEW_BODY_MAX = 10_000;

export const reviewBodySchema = z.string().trim().min(1).max(REVIEW_BODY_MAX);

export const trackRatingInputSchema = z.object({ trackId: z.uuid(), rating: ratingSchema });

/** Fields of a diary entry that the member edits in the "log" form. */
const entryFields = {
  rating: ratingSchema.nullable(),
  liked: z.boolean(),
  relisten: z.boolean(),
  format: listenFormatSchema.nullable(),
  moodIds: z.array(z.uuid()).max(MOODS_PER_ENTRY_MAX),
  /** Album listens only; replaces the previous set. */
  trackRatings: z.array(trackRatingInputSchema).max(300),
};

export const entryCreateSchema = z.object({
  target: listenTargetSchema,
  /** Omitted: today in the member's time zone. */
  listenedOn: listenedOnSchema.optional(),
  ...entryFields,
  /** Optional review written with the listen (rating and review stay independent). */
  review: z.object({ body: reviewBodySchema, lang: audienceLangSchema }).nullable().optional(),
});
export type EntryCreateInput = z.infer<typeof entryCreateSchema>;

/** A listen keeps its date once it has one; an undated listen can be given a date. */
export const entryUpdateSchema = z.object({
  id: z.uuid(),
  listenedOn: listenedOnSchema.nullable(),
  ...entryFields,
});
export type EntryUpdateInput = z.infer<typeof entryUpdateSchema>;

/**
 * Order of the quick ratings sent by one item panel (a random id per mounted panel, and a
 * number growing with each rating): an older request arriving late never overwrites a newer.
 */
export const quickOrderSchema = z.object({
  clientId: z.uuid(),
  seq: z.number().int().min(1).max(2_147_483_647),
});
export type QuickOrderInput = z.infer<typeof quickOrderSchema>;

export const quickRateSchema = z.object({
  target: listenTargetSchema,
  rating: ratingSchema.nullable(),
  order: quickOrderSchema.optional(),
});
export const quickLikeSchema = z.object({ target: listenTargetSchema, liked: z.boolean() });
export const wantToListenSchema = z.object({
  target: listenTargetSchema,
  wantToListen: z.boolean(),
});

export const moodLabelSchema = z.string().trim().min(1).max(40);

export const reviewCreateSchema = z.object({
  target: listenTargetSchema,
  body: reviewBodySchema,
  lang: audienceLangSchema,
  /** The member's own listen of the same target. */
  entryId: z.uuid().nullable().optional(),
});
export const reviewUpdateSchema = z.object({
  id: z.uuid(),
  body: reviewBodySchema,
  lang: audienceLangSchema,
});

/**
 * Album rating suggested by track-by-track ratings: their mean, rounded to the nearest half
 * star. Only a suggestion: it is shown to the member, never applied by itself.
 */
export function suggestAlbumRating(trackRatings: number[]): number | null {
  if (trackRatings.length === 0) return null;
  const mean = trackRatings.reduce((sum, r) => sum + r, 0) / trackRatings.length;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(mean)));
}

/** True when `timeZone` is an IANA zone known to the runtime ("Europe/Paris"). */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().min(1).max(64).refine(isTimeZone);

/** Calendar date ("YYYY-MM-DD") of `now` in `timeZone`, not in the server's zone. */
export function todayIn(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
