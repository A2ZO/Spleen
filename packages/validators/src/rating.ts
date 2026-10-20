import { z } from "zod";

/**
 * Ratings are stored as integers 1..10 (half-stars) and shown as 0.5..5 stars.
 * Rating and review are independent: a rating is always optional.
 */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

export const ratingSchema = z.number().int().min(RATING_MIN).max(RATING_MAX);
export type Rating = z.infer<typeof ratingSchema>;

export function ratingToStars(rating: number): number {
  return rating / 2;
}

/** Rounds to the nearest half star, then clamps to the valid range. */
export function starsToRating(stars: number): Rating {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(stars * 2)));
}
