import { sql, type AnyColumn, type SQL } from "@spleen/db";
import { RATING_MAX } from "@spleen/validators";

/**
 * The member is not suspended (SQL condition on a user id column): a suspended member's ratings
 * and listens leave every public figure (averages, distributions, trends, top rated) and come
 * back when the suspension is lifted. Computed on the fly, so there is nothing to invalidate.
 */
export function countsPublicly(userId: AnyColumn | SQL) {
  return sql`not exists (select 1 from "profiles" "sp" where "sp"."user_id" = ${userId} and "sp"."suspended_at" is not null)`;
}

export function emptyDistribution(): number[] {
  return Array.from({ length: RATING_MAX }, () => 0);
}

/** Weighted mean of a 1..10 distribution, rounded to one decimal; null when empty. */
export function averageFromDistribution(counts: number[]): number | null {
  let total = 0;
  let sum = 0;
  counts.forEach((count, index) => {
    total += count;
    sum += count * (index + 1);
  });
  return total === 0 ? null : Math.round((sum / total) * 10) / 10;
}

export function countRatings(counts: number[]): number {
  return counts.reduce((acc, count) => acc + count, 0);
}
