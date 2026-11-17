import { z } from "zod";

import { audienceLangSchema, releaseTypeSchema, slugSchema } from "./catalog";
import { pageNumberSchema } from "./profile";

/** Oldest year a ranking can be filtered on (anything older is a typo). */
export const DISCOVERY_YEAR_MIN = 1900;
const yearSchema = z.number().int().min(DISCOVERY_YEAR_MIN).max(2100);

/** `size`: how many a page shows (the home page shows fewer than /discover); at most 10. */
export const trendsSchema = z.object({
  lang: audienceLangSchema,
  size: z.number().int().min(1).max(10).optional(),
});

/** Recent releases: albums and EPs, or one type only; `size` per page, at most 24. */
export const recentReleasesSchema = z.object({
  type: releaseTypeSchema.optional(),
  page: pageNumberSchema.default(1),
  size: z.number().int().min(1).max(24).optional(),
});

/** Top rated releases, filtered by genre and by year or decade (not both). */
export const topRatedSchema = z
  .object({
    genre: slugSchema.optional(),
    year: yearSchema.optional(),
    decade: yearSchema.refine((y) => y % 10 === 0).optional(),
    type: releaseTypeSchema.default("album"),
    page: pageNumberSchema.default(1),
  })
  .refine((input) => input.year === undefined || input.decade === undefined, {
    message: "year and decade cannot both be set",
  });
export type TopRatedInput = z.infer<typeof topRatedSchema>;

/** « Mes sorties à venir »: the three types, or one. */
export const upcomingMineSchema = z.object({ type: releaseTypeSchema.optional() });

/** « Tire un disque »: total length of a record, `medium` from 30 to 60 minutes inclusive. */
export const pickDurations = ["short", "medium", "long"] as const;
export const pickDurationSchema = z.enum(pickDurations);
export type PickDuration = z.infer<typeof pickDurationSchema>;

/** « Tire un disque »: optional filters, and the record shown (`not`) to draw another one. */
export const pickSchema = z.object({
  type: releaseTypeSchema.optional(),
  duration: pickDurationSchema.optional(),
  not: z.uuid().optional(),
});
export type PickInput = z.infer<typeof pickSchema>;
