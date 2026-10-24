import { and, eq, gte, isNotNull, isNull, lt, schema, sql, type Db } from "@spleen/db";

import type { BaseStats, ListenedCounts } from "../../types";
import { emptyDistribution } from "../ratings";
import { yearRange } from "./source";

/* Free-tier stats, one aggregate query per block (rules in `source.ts`). */

const TOP_LIMIT = 5;

const { artists, entries, genres, releaseArtists, releaseGenres, releases } = schema;
const { trackArtists, userItemState } = schema;

const int = (expr: ReturnType<typeof sql>) => expr.mapWith(Number);

function emptyCounts(): ListenedCounts {
  return { album: 0, ep: 0, single: 0, track: 0 };
}

async function listenedCounts(db: Db, userId: string, year: number) {
  const { start, end } = yearRange(year);
  const kind = sql<string>`coalesce(${releases.type}::text, 'track')`;
  const item = sql`coalesce(${entries.releaseId}, ${entries.trackId})`;
  const rows = await db
    .select({
      kind,
      thisYear: int(
        sql`count(distinct ${item}) filter (where ${entries.listenedOn} >= ${start} and ${entries.listenedOn} < ${end})`,
      ),
      total: int(sql`count(distinct ${item})`),
    })
    .from(entries)
    .leftJoin(releases, eq(releases.id, entries.releaseId))
    .where(and(eq(entries.userId, userId), isNull(entries.artistId)))
    .groupBy(kind);
  const thisYear = emptyCounts();
  const total = emptyCounts();
  for (const r of rows) {
    const k = r.kind as keyof ListenedCounts;
    thisYear[k] = r.thisYear;
    total[k] = r.total;
  }
  return { thisYear, total };
}

async function ratingDistribution(db: Db, userId: string) {
  const rows = await db
    .select({ rating: userItemState.rating, count: int(sql`count(*)`) })
    .from(userItemState)
    .where(
      and(
        eq(userItemState.userId, userId),
        isNotNull(userItemState.releaseId),
        isNotNull(userItemState.rating),
      ),
    )
    .groupBy(userItemState.rating);
  const distribution = emptyDistribution();
  for (const r of rows) distribution[r.rating! - 1] = r.count;
  return distribution;
}

/** Dated listens of the year (album and track listens). */
function inYear(userId: string, year: number) {
  const { start, end } = yearRange(year);
  return and(
    eq(entries.userId, userId),
    gte(entries.listenedOn, start),
    lt(entries.listenedOn, end),
  );
}

async function topArtists(db: Db, userId: string, year: number) {
  const credits = db
    .select({ artistId: releaseArtists.artistId })
    .from(entries)
    .innerJoin(releaseArtists, eq(releaseArtists.releaseId, entries.releaseId))
    .where(inYear(userId, year))
    .unionAll(
      db
        .select({ artistId: trackArtists.artistId })
        .from(entries)
        .innerJoin(trackArtists, eq(trackArtists.trackId, entries.trackId))
        .where(inYear(userId, year)),
    )
    .as("credits");
  const count = int(sql`count(*)`);
  return db
    .select({ slug: artists.slug, name: artists.name, count })
    .from(credits)
    .innerJoin(artists, eq(artists.id, credits.artistId))
    .groupBy(artists.id, artists.slug, artists.name)
    .orderBy(sql`count(*) desc`, artists.name)
    .limit(TOP_LIMIT);
}

async function topGenres(db: Db, userId: string, year: number) {
  return db
    .select({ name: genres.name, count: int(sql`count(*)`) })
    .from(entries)
    .innerJoin(releaseGenres, eq(releaseGenres.releaseId, entries.releaseId))
    .innerJoin(genres, eq(genres.id, releaseGenres.genreId))
    .where(inYear(userId, year))
    .groupBy(genres.id, genres.name)
    .orderBy(sql`count(*) desc`, genres.name)
    .limit(TOP_LIMIT);
}

async function decades(db: Db, userId: string) {
  const decade = int(sql`(extract(year from ${releases.releaseDate})::int / 10) * 10`);
  return db
    .select({ decade, count: int(sql`count(*)`) })
    .from(entries)
    .innerJoin(releases, eq(releases.id, entries.releaseId))
    .where(and(eq(entries.userId, userId), isNotNull(releases.releaseDate)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

async function activityByMonth(db: Db, userId: string, year: number) {
  const month = int(sql`extract(month from ${entries.listenedOn})::int`);
  const rows = await db
    .select({ month, count: int(sql`count(*)`) })
    .from(entries)
    .where(and(inYear(userId, year), isNull(entries.artistId)))
    .groupBy(sql`1`);
  const activity = Array.from({ length: 12 }, () => 0);
  for (const r of rows) activity[r.month - 1] = r.count;
  return activity;
}

/** Free-tier stats of a member for `year` (their current year, in their time zone). */
export async function computeBaseStats(db: Db, userId: string, year: number): Promise<BaseStats> {
  const [counts, distribution, artistsTop, genresTop, decadeRows, activity] = await Promise.all([
    listenedCounts(db, userId, year),
    ratingDistribution(db, userId),
    topArtists(db, userId, year),
    topGenres(db, userId, year),
    decades(db, userId),
    activityByMonth(db, userId, year),
  ]);
  return {
    year,
    listenedThisYear: counts.thisYear,
    listenedTotal: counts.total,
    ratingDistribution: distribution,
    topArtists: artistsTop,
    topGenres: genresTop,
    decades: decadeRows,
    activityByMonth: activity,
  };
}
