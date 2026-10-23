import { and, asc, eq, inArray, isNotNull, schema, type Db } from "@spleen/db";

import { loadReleaseCards } from "./catalog/cards";
import type { StatsInput } from "./stats";

/*
 * Where the base stats read their data (milestone 6 replaces the computation with SQL
 * aggregates cached in `user_stats_cache`, invalidated by `recomputeItemState`):
 * - source: the member's album/EP/single listens in `entries` (track listens are not counted
 *   yet), joined to `releases`, `release_artists` and `release_genres`;
 * - undated listens (`listened_on` null) count in all-time totals only, never in per-year or
 *   per-month figures nor in the calendar;
 * - the rating distribution uses the current rating per release (`user_item_state.rating`,
 *   i.e. the most recently edited rated listen).
 * Until then, `computeBaseStats` runs on the rows loaded here and is the reference behaviour.
 */
export async function loadStatsInput(db: Db, userId: string): Promise<StatsInput[]> {
  const { entries, genres, releaseGenres } = schema;
  const rows = await db
    .select({
      releaseId: entries.releaseId,
      listenedOn: entries.listenedOn,
      updatedAt: entries.updatedAt,
      rating: entries.rating,
    })
    .from(entries)
    .where(and(eq(entries.userId, userId), isNotNull(entries.releaseId)))
    .orderBy(asc(entries.listenedOn));
  const releaseIds = [...new Set(rows.map((r) => r.releaseId!))];
  if (releaseIds.length === 0) return [];
  const [cards, genreRows] = await Promise.all([
    loadReleaseCards(db, releaseIds),
    db
      .select({ releaseId: releaseGenres.releaseId, name: genres.name })
      .from(releaseGenres)
      .innerJoin(genres, eq(genres.id, releaseGenres.genreId))
      .where(inArray(releaseGenres.releaseId, releaseIds)),
  ]);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  return rows.flatMap((r) => {
    const card = cardById.get(r.releaseId!);
    if (!card) return [];
    return {
      listenedOn: r.listenedOn,
      editedAt: r.updatedAt.toISOString(),
      rating: r.rating,
      release: {
        id: card.id,
        type: card.type,
        releaseYear: card.year,
        genres: genreRows.filter((g) => g.releaseId === card.id).map((g) => g.name),
        artists: card.artists,
      },
    };
  });
}
