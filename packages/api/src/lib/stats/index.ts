import { eq, schema, type Db } from "@spleen/db";
import { todayIn } from "@spleen/validators";

import type { BaseStats, MemberStats } from "../../types";
import { computeBaseStats } from "./base";

/*
 * Member stats, cached per member in `user_stats_cache`. The cache is deleted by every
 * listening write (`recomputeItemState`), and recomputed on read when its format changed,
 * when the member's year turned, or after `MAX_AGE_MS` (catalog data such as genres can be
 * completed later by an import). A read racing a write may cache slightly stale figures:
 * the age limit bounds it.
 *
 * Spleen+ (later): advanced stats become another cached section next to `base`, filled only
 * for subscribers and returned in `MemberStats.plus`; free stats never change shape.
 */

/** Bump when the cached shape or a rule changes: old rows are then recomputed. */
const CACHE_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CachedStats {
  version: number;
  year: number;
  sections: { base: BaseStats };
}

const { profiles, userStatsCache } = schema;

function isFresh(data: unknown, computedAt: Date, year: number, now: Date): data is CachedStats {
  const cached = data as Partial<CachedStats> | null;
  return (
    cached?.version === CACHE_VERSION &&
    cached.year === year &&
    now.getTime() - computedAt.getTime() < MAX_AGE_MS
  );
}

/** Stats of a member, from the cache when fresh. Null for an unknown member. */
export async function getMemberStats(
  db: Db,
  userId: string,
  now: Date,
): Promise<MemberStats | null> {
  const [profile] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  if (!profile) return null;
  const year = Number(todayIn(profile.timeZone, now).slice(0, 4));

  const [row] = await db
    .select({ data: userStatsCache.data, computedAt: userStatsCache.computedAt })
    .from(userStatsCache)
    .where(eq(userStatsCache.userId, userId));
  if (row && isFresh(row.data, row.computedAt, year, now)) {
    return toMemberStats(row.data, row.computedAt);
  }

  const data: CachedStats = {
    version: CACHE_VERSION,
    year,
    sections: { base: await computeBaseStats(db, userId, year) },
  };
  await db
    .insert(userStatsCache)
    .values({ userId, data, computedAt: now })
    .onConflictDoUpdate({ target: userStatsCache.userId, set: { data, computedAt: now } });
  return toMemberStats(data, now);
}

function toMemberStats(data: CachedStats, computedAt: Date): MemberStats {
  return {
    tier: "free",
    base: data.sections.base,
    plus: null,
    computedAt: computedAt.toISOString(),
  };
}

export function hasListened(stats: BaseStats): boolean {
  const t = stats.listenedTotal;
  return t.album + t.ep + t.single + t.track > 0;
}
