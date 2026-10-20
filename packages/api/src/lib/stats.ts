import type { ReleaseType } from "@spleen/validators";

import type { CountByType, ProfileStats } from "../types";
import { emptyDistribution } from "./ratings";

/** Minimal listen data needed to compute base stats; mirrors future SQL aggregates. */
export interface StatsInput {
  listenedOn: string;
  rating: number | null;
  release: {
    id: string;
    type: ReleaseType;
    releaseYear: number;
    genres: string[];
    artists: { slug: string; name: string }[];
  };
}

const TOP_LIMIT = 5;

function emptyCount(): CountByType {
  return { album: 0, ep: 0, single: 0 };
}

function topN<T extends { count: number }>(map: Map<string, T>): T[] {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, TOP_LIMIT);
}

/**
 * Free-tier stats: distinct releases listened (this year / total), rating distribution
 * (latest rating per release), top 5 artists and genres of the year, decades, activity per month.
 */
export function computeBaseStats(entries: StatsInput[], year: number): ProfileStats {
  const yearPrefix = `${year}-`;
  const thisYear = entries.filter((e) => e.listenedOn.startsWith(yearPrefix));

  const countDistinct = (list: StatsInput[]): CountByType => {
    const seen = new Map<string, ReleaseType>();
    for (const e of list) seen.set(e.release.id, e.release.type);
    const counts = emptyCount();
    for (const type of seen.values()) counts[type] += 1;
    return counts;
  };

  const latestRating = new Map<string, { on: string; rating: number }>();
  for (const e of entries) {
    if (e.rating === null) continue;
    const prev = latestRating.get(e.release.id);
    if (!prev || e.listenedOn > prev.on)
      latestRating.set(e.release.id, { on: e.listenedOn, rating: e.rating });
  }
  const ratingDistribution = emptyDistribution();
  for (const { rating } of latestRating.values()) ratingDistribution[rating - 1]! += 1;

  const artistCounts = new Map<string, { slug: string; name: string; count: number }>();
  const genreCounts = new Map<string, { name: string; count: number }>();
  const activityByMonth = Array.from({ length: 12 }, () => 0);
  for (const e of thisYear) {
    for (const a of e.release.artists) {
      const cur = artistCounts.get(a.slug) ?? { ...a, count: 0 };
      cur.count += 1;
      artistCounts.set(a.slug, cur);
    }
    for (const g of e.release.genres) {
      const cur = genreCounts.get(g) ?? { name: g, count: 0 };
      cur.count += 1;
      genreCounts.set(g, cur);
    }
    activityByMonth[Number(e.listenedOn.slice(5, 7)) - 1]! += 1;
  }

  const decadeCounts = new Map<number, number>();
  for (const e of entries) {
    const decade = Math.floor(e.release.releaseYear / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }

  return {
    year,
    listenedThisYear: countDistinct(thisYear),
    listenedTotal: countDistinct(entries),
    ratingDistribution,
    topArtists: topN(artistCounts),
    topGenres: topN(genreCounts),
    decades: [...decadeCounts.entries()]
      .map(([decade, count]) => ({ decade, count }))
      .sort((a, b) => a.decade - b.decade),
    activityByMonth,
  };
}
