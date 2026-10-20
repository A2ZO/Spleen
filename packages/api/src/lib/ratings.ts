import { RATING_MAX } from "@spleen/validators";

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
