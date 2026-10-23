import { eq, schema, sql, type Db } from "@spleen/db";
import { todayIn } from "@spleen/validators";

import type { BaseStats, MemberStats } from "../../types";
import { computeBaseStats } from "./base";

/*
 * Member stats, cached per member in `user_stats_cache`. Every listening write bumps the
 * member's stats version in its own transaction (`bumpStatsVersion`); the cache keeps the
 * version read *before* computing, so a read that raced a write stores an outdated version
 * and the next read recomputes. It is also recomputed when its format changed, when the
 * member's year turned, or after `MAX_AGE_MS` (catalog data such as genres can be completed
 * later by an import).
 *
 * Spleen+ (later): advanced stats become another cached section next to `base`, filled only
 * for subscribers and returned in `MemberStats.plus`; free stats never change shape.
 */

/** Bump when the cached shape or a rule changes: old rows are then recomputed. */
const CACHE_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CachedStats {
  version: number;
  year: number;
  sections: { base: BaseStats };
}

const { profiles, userListeningVersion, userStatsCache } = schema;

function isFresh(data: unknown, computedAt: Date, year: number, now: Date): data is CachedStats {
  const cached = data as Partial<CachedStats> | null;
  return (
    cached?.version === CACHE_VERSION &&
    cached.year === year &&
    now.getTime() - computedAt.getTime() < MAX_AGE_MS
  );
}

/** The member's time zone and current stats version; null for an unknown member. */
export async function readStatsMember(db: Db, userId: string) {
  const [row] = await db
    .select({
      timeZone: profiles.timeZone,
      statsVersion: sql<number>`coalesce(${userListeningVersion.statsVersion}, 0)`.mapWith(Number),
    })
    .from(profiles)
    .leftJoin(userListeningVersion, eq(userListeningVersion.userId, profiles.userId))
    .where(eq(profiles.userId, userId));
  return row ?? null;
}

export async function computeStats(db: Db, userId: string, year: number): Promise<CachedStats> {
  return {
    version: CACHE_VERSION,
    year,
    sections: { base: await computeBaseStats(db, userId, year) },
  };
}

/**
 * Stores computed stats with the stats version read before computing. A slower reader never
 * replaces a cache computed from a newer version.
 */
export async function storeStats(
  db: Db,
  userId: string,
  statsVersion: number,
  data: CachedStats,
  now: Date,
): Promise<void> {
  await db
    .insert(userStatsCache)
    .values({ userId, statsVersion, data, computedAt: now })
    .onConflictDoUpdate({
      target: userStatsCache.userId,
      set: { statsVersion, data, computedAt: now },
      setWhere: sql`${userStatsCache.statsVersion} <= ${statsVersion}`,
    });
}

/** Stats of a member, from the cache when fresh. Null for an unknown member. */
export async function getMemberStats(
  db: Db,
  userId: string,
  now: Date,
): Promise<MemberStats | null> {
  const member = await readStatsMember(db, userId);
  if (!member) return null;
  const year = Number(todayIn(member.timeZone, now).slice(0, 4));

  const [row] = await db
    .select({
      statsVersion: userStatsCache.statsVersion,
      data: userStatsCache.data,
      computedAt: userStatsCache.computedAt,
    })
    .from(userStatsCache)
    .where(eq(userStatsCache.userId, userId));
  if (
    row &&
    row.statsVersion === member.statsVersion &&
    isFresh(row.data, row.computedAt, year, now)
  ) {
    return toMemberStats(row.data, row.computedAt);
  }

  const data = await computeStats(db, userId, year);
  await storeStats(db, userId, member.statsVersion, data, now);
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
