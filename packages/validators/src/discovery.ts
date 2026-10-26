import { z } from "zod";

import { audienceLangSchema, releaseTypeSchema, slugSchema } from "./catalog";
import { pageNumberSchema } from "./profile";

/** Oldest year a ranking can be filtered on (anything older is a typo). */
export const DISCOVERY_YEAR_MIN = 1900;
const yearSchema = z.number().int().min(DISCOVERY_YEAR_MIN).max(2100);

export const trendsSchema = z.object({ lang: audienceLangSchema });

/** Recent releases: albums and EPs, or one type only. */
export const recentReleasesSchema = z.object({
  type: releaseTypeSchema.optional(),
  page: pageNumberSchema.default(1),
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
