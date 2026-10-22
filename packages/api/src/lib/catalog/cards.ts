import { and, asc, inArray, isNotNull, schema, sql, type Db } from "@spleen/db";

import type { ArtistCard, ArtistRef, ReleaseCard, TrackCard } from "../../types";

/*
 * Batch loaders for the cards shown everywhere (search, artist pages, lists…): one query per
 * table whatever the number of cards, results in the order of the ids given.
 */

const { artists, releaseArtists, releaseTracks, releases, trackArtists, tracks, userItemState } =
  schema;

export interface ReleaseCardWithTypes extends ReleaseCard {
  secondaryTypes: string[];
  releaseDate: string | null;
}

const byIdOrder = <T extends { id: string }>(ids: string[], rows: T[]): T[] => {
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => map.get(id) ?? []);
};

/** Community average (1..10) and number of ratings, from each member's latest state. */
export async function ratingSummaries(
  db: Db,
  column: "releaseId" | "trackId",
  ids: string[],
): Promise<Map<string, { average: number; count: number }>> {
  if (ids.length === 0) return new Map();
  const target = userItemState[column];
  const rows = await db
    .select({
      id: target,
      average: sql<string>`avg(${userItemState.rating})`,
      count: sql<number>`count(${userItemState.rating})::int`,
    })
    .from(userItemState)
    .where(and(inArray(target, ids), isNotNull(userItemState.rating)))
    .groupBy(target);
  return new Map(
    rows.map((r) => [r.id!, { average: Number(Number(r.average).toFixed(2)), count: r.count }]),
  );
}

async function releaseArtistRefs(db: Db, releaseIds: string[]) {
  const rows =
    releaseIds.length === 0
      ? []
      : await db
          .select({
            releaseId: releaseArtists.releaseId,
            slug: artists.slug,
            name: artists.name,
          })
          .from(releaseArtists)
          .innerJoin(artists, sql`${artists.id} = ${releaseArtists.artistId}`)
          .where(inArray(releaseArtists.releaseId, releaseIds))
          .orderBy(asc(releaseArtists.position));
  const map = new Map<string, ArtistRef[]>();
  for (const { releaseId, slug, name } of rows) {
    map.set(releaseId, [...(map.get(releaseId) ?? []), { slug, name }]);
  }
  return map;
}

export async function loadReleaseCards(db: Db, ids: string[]): Promise<ReleaseCardWithTypes[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const [rows, artistMap, ratings] = await Promise.all([
    db.select().from(releases).where(inArray(releases.id, unique)),
    releaseArtistRefs(db, unique),
    ratingSummaries(db, "releaseId", unique),
  ]);
  return byIdOrder(
    unique,
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      type: r.type,
      year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : null,
      coverUrl: r.coverUrl,
      artists: artistMap.get(r.id) ?? [],
      averageRating: ratings.get(r.id)?.average ?? null,
      ratingCount: ratings.get(r.id)?.count ?? 0,
      secondaryTypes: r.secondaryTypes,
      releaseDate: r.releaseDate,
    })),
  );
}

/** Public card shape (drops the fields only used to sort and group). */
export const toReleaseCard = ({
  secondaryTypes: _types,
  releaseDate: _date,
  ...card
}: ReleaseCardWithTypes): ReleaseCard => card;

export async function loadArtistCards(db: Db, ids: string[]): Promise<ArtistCard[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      disambiguation: artists.disambiguation,
      country: artists.country,
      imageUrl: artists.imageUrl,
    })
    .from(artists)
    .where(inArray(artists.id, ids));
  return byIdOrder(ids, rows);
}

export async function trackArtistRefs(db: Db, trackIds: string[]) {
  const rows =
    trackIds.length === 0
      ? []
      : await db
          .select({ trackId: trackArtists.trackId, slug: artists.slug, name: artists.name })
          .from(trackArtists)
          .innerJoin(artists, sql`${artists.id} = ${trackArtists.artistId}`)
          .where(inArray(trackArtists.trackId, trackIds))
          .orderBy(asc(trackArtists.position));
  const map = new Map<string, ArtistRef[]>();
  for (const { trackId, slug, name } of rows) {
    map.set(trackId, [...(map.get(trackId) ?? []), { slug, name }]);
  }
  return map;
}

/** Releases each track appears on, oldest release first. */
export async function trackReleaseIds(db: Db, trackIds: string[]) {
  const rows =
    trackIds.length === 0
      ? []
      : await db
          .selectDistinct({
            trackId: releaseTracks.trackId,
            releaseId: releaseTracks.releaseId,
            releaseDate: releases.releaseDate,
          })
          .from(releaseTracks)
          .innerJoin(releases, sql`${releases.id} = ${releaseTracks.releaseId}`)
          .where(inArray(releaseTracks.trackId, trackIds))
          .orderBy(sql`${releases.releaseDate} asc nulls last`);
  const map = new Map<string, string[]>();
  for (const { trackId, releaseId } of rows) {
    map.set(trackId, [...(map.get(trackId) ?? []), releaseId]);
  }
  return map;
}

export async function loadTrackCards(db: Db, ids: string[]): Promise<TrackCard[]> {
  if (ids.length === 0) return [];
  const [rows, artistMap, releaseMap] = await Promise.all([
    db.select().from(tracks).where(inArray(tracks.id, ids)),
    trackArtistRefs(db, ids),
    trackReleaseIds(db, ids),
  ]);
  const firstReleases = await loadReleaseCards(
    db,
    ids.flatMap((id) => releaseMap.get(id)?.[0] ?? []),
  );
  const releaseById = new Map(firstReleases.map((r) => [r.id, toReleaseCard(r)]));
  return byIdOrder(
    ids,
    rows.map((t) => {
      const firstRelease = releaseMap.get(t.id)?.[0];
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        durationMs: t.durationMs,
        artists: artistMap.get(t.id) ?? [],
        release: firstRelease ? (releaseById.get(firstRelease) ?? null) : null,
      };
    }),
  );
}
