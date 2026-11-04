import { isMainRelease } from "@spleen/catalog";
import { and, asc, desc, eq, inArray, isNotNull, isNull, schema, sql, type Db } from "@spleen/db";
import type { AudienceLang } from "@spleen/validators";

import type {
  ArtistDetail,
  ListCard,
  ReleaseCard,
  ReleaseDetail,
  ReviewCard,
  Track,
  TrackDetail,
} from "../../types";
import { buildListenLinks } from "../listen-links";
import { seoPage } from "../seo";
import { countsPublicly } from "../ratings";
import { notBlockedWith } from "../social/relations";
import { reviewCountColumns } from "../social/reviews";
import {
  loadReleaseCards,
  loadTrackCards,
  ratingSummaries,
  toReleaseCard,
  trackReleaseIds,
  type ReleaseCardWithTypes,
} from "./cards";

/* Item pages read from the database: catalog rows plus the community data around them. */

const REVIEWS_ON_PAGE = 10;
const LISTS_ON_PAGE = 6;
const LIST_PREVIEW_SIZE = 4;

const { artists, genres, lists, listItems, profiles, releaseArtists, releaseGenres } = schema;
const { releaseTracks, releases, reviews, tracks, userItemState } = schema;

/** The release row behind a slug (merged releases left out), reused by `getReleaseDetail`. */
export async function releaseIdBySlug(db: Db, slug: string) {
  const [row] = await db
    .select()
    .from(releases)
    .where(and(eq(releases.slug, slug), isNull(releases.mergedIntoId)))
    .limit(1);
  return row ?? null;
}

/** Ratings 1..10 of the release (suspended members left out, as in `ratingSummaries`). */
async function ratingDistribution(db: Db, releaseId: string): Promise<number[]> {
  const rows = await db
    .select({ rating: userItemState.rating, count: sql<number>`count(*)::int` })
    .from(userItemState)
    .where(
      and(
        eq(userItemState.releaseId, releaseId),
        isNotNull(userItemState.rating),
        countsPublicly(userItemState.userId),
      ),
    )
    .groupBy(userItemState.rating);
  const distribution = Array.from({ length: 10 }, () => 0);
  for (const { rating, count } of rows) distribution[rating! - 1] = count;
  return distribution;
}

/**
 * Most liked reviews of the release. With a viewer, reviews by members blocked either way
 * are left out and comment counts skip the comments hidden from them.
 */
/** The query starts at once; the release card (read in parallel) is awaited only to map rows. */
async function releaseReviews(
  db: Db,
  releaseId: string,
  card: Promise<ReleaseCard>,
  viewerId: string | null,
): Promise<ReviewCard[]> {
  const { likeCount, commentCount } = reviewCountColumns(viewerId);
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      lang: reviews.lang,
      createdAt: reviews.createdAt,
      username: profiles.username,
      displayName: profiles.displayName,
      likeCount,
      commentCount,
    })
    .from(reviews)
    .innerJoin(profiles, eq(profiles.userId, reviews.userId))
    .where(
      and(
        eq(reviews.releaseId, releaseId),
        isNull(reviews.hiddenAt),
        viewerId ? notBlockedWith(viewerId, reviews.userId) : undefined,
      ),
    )
    .orderBy(desc(likeCount), desc(reviews.createdAt))
    .limit(REVIEWS_ON_PAGE);
  const release = await card;
  return rows.map((r) => ({
    id: r.id,
    author: { username: r.username, displayName: r.displayName },
    release,
    rating: r.rating,
    body: r.body,
    lang: r.lang as AudienceLang,
    createdAt: r.createdAt.toISOString(),
    likeCount: r.likeCount,
    commentCount: r.commentCount,
  }));
}

type ListRow = {
  id: string;
  title: string;
  description: string;
  ranked: boolean;
  username: string;
  displayName: string;
};

/** List cards with a preview of their first releases (two queries whatever the count). */
export async function loadListCards(db: Db, rows: ListRow[]): Promise<ListCard[]> {
  if (rows.length === 0) return [];
  const items = await db
    .select({ listId: listItems.listId, releaseId: listItems.releaseId })
    .from(listItems)
    .where(
      inArray(
        listItems.listId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(listItems.position));
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        items.flatMap((i) => i.releaseId ?? []),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  return rows.map((list) => {
    const own = items.filter((i) => i.listId === list.id);
    return {
      id: list.id,
      title: list.title,
      description: list.description,
      ranked: list.ranked,
      owner: { username: list.username, displayName: list.displayName },
      itemCount: own.length,
      preview: own
        .flatMap((i) => (i.releaseId ? (cards.get(i.releaseId) ?? []) : []))
        .slice(0, LIST_PREVIEW_SIZE),
    };
  });
}

export const listRowColumns = {
  id: lists.id,
  title: lists.title,
  description: lists.description,
  ranked: lists.ranked,
  updatedAt: lists.updatedAt,
  username: profiles.username,
  displayName: profiles.displayName,
};

/** Lists containing the release (none by members blocked either way with the viewer). */
async function releaseLists(
  db: Db,
  releaseId: string,
  viewerId: string | null,
): Promise<ListCard[]> {
  const rows = await db
    .selectDistinct(listRowColumns)
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .innerJoin(profiles, eq(profiles.userId, lists.userId))
    .where(
      and(
        eq(listItems.releaseId, releaseId),
        isNull(lists.hiddenAt),
        viewerId ? notBlockedWith(viewerId, lists.userId) : undefined,
      ),
    )
    .orderBy(desc(lists.updatedAt))
    .limit(LISTS_ON_PAGE);
  return loadListCards(db, rows);
}

/**
 * `viewerId` shapes the community parts (blocks, comment counts); null when signed out.
 * `known` is the row `releaseIdBySlug` already read (skips reading it again). Everything after
 * the row runs in one wave, the search metadata (`seoPage`) included, so `generateMetadata`
 * needs no query of its own.
 */
export async function getReleaseDetail(
  db: Db,
  slug: string,
  viewerId: string | null,
  known?: typeof releases.$inferSelect,
): Promise<ReleaseDetail | null> {
  const row =
    known ?? (await db.select().from(releases).where(eq(releases.slug, slug)).limit(1))[0];
  if (!row) return null;
  const card = loadReleaseCards(db, [row.id]).then(([c]) => toReleaseCard(c!));

  const [release, genreRows, trackRows, distribution, reviewCards, listCards, seo] =
    await Promise.all([
      card,
      db
        .select({ name: genres.name })
        .from(releaseGenres)
        .innerJoin(genres, eq(genres.id, releaseGenres.genreId))
        .where(eq(releaseGenres.releaseId, row.id))
        .orderBy(asc(genres.name)),
      db
        .select({
          id: tracks.id,
          slug: tracks.slug,
          disc: releaseTracks.disc,
          position: releaseTracks.position,
          title: tracks.title,
          durationMs: tracks.durationMs,
        })
        .from(releaseTracks)
        .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
        .where(eq(releaseTracks.releaseId, row.id))
        .orderBy(asc(releaseTracks.disc), asc(releaseTracks.position)),
      ratingDistribution(db, row.id),
      releaseReviews(db, row.id, card, viewerId),
      releaseLists(db, row.id, viewerId),
      seoPage(db, "release", row.slug),
    ]);
  const trackList: Track[] = trackRows;

  return {
    ...release,
    releaseDate: row.releaseDate,
    releaseDatePrecision: row.releaseDatePrecision,
    secondaryTypes: row.secondaryTypes,
    isStub: !!row.mbid && !row.tracklistImportedAt,
    genres: genreRows.map((g) => g.name),
    tracks: trackList,
    totalDurationMs: trackList.reduce((total, t) => total + (t.durationMs ?? 0), 0),
    ratingDistribution: distribution,
    reviews: reviewCards,
    lists: listCards,
    listenLinks: buildListenLinks(
      row.title,
      release.artists.map((a) => a.name),
    ),
    seo,
  };
}

/** The artist row behind a slug (merged artists left out), reused by `getArtistDetail`. */
export async function artistIdBySlug(db: Db, slug: string) {
  const [row] = await db
    .select()
    .from(artists)
    .where(and(eq(artists.slug, slug), isNull(artists.mergedIntoId)))
    .limit(1);
  return row ?? null;
}

/** Newest first; undated releases last. */
const byDateDesc = (a: ReleaseCardWithTypes, b: ReleaseCardWithTypes) =>
  (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "");

/** `known`: the row `artistIdBySlug` already read. The search metadata comes in parallel. */
export async function getArtistDetail(
  db: Db,
  slug: string,
  known?: typeof artists.$inferSelect,
): Promise<ArtistDetail | null> {
  const row = known ?? (await db.select().from(artists).where(eq(artists.slug, slug)).limit(1))[0];
  if (!row) return null;
  const [releaseIds, seo] = await Promise.all([
    db
      .select({ id: releaseArtists.releaseId })
      .from(releaseArtists)
      .where(eq(releaseArtists.artistId, row.id))
      .then((rows) => rows.map((r) => r.id)),
    seoPage(db, "artist", row.slug),
  ]);
  const cards = (await loadReleaseCards(db, releaseIds)).sort(byDateDesc);
  const main = cards.filter((c) => isMainRelease(c.secondaryTypes));
  const ofType = (type: ReleaseCard["type"]) =>
    main.filter((c) => c.type === type).map(toReleaseCard);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    disambiguation: row.disambiguation,
    country: row.country,
    imageUrl: row.imageUrl,
    type: row.type,
    discographyPending: !!row.mbid && !row.discographyImportedAt,
    discography: {
      albums: ofType("album"),
      eps: ofType("ep"),
      singles: ofType("single"),
      other: cards.filter((c) => !isMainRelease(c.secondaryTypes)).map(toReleaseCard),
    },
    listenLinks: buildListenLinks("", [row.name]),
    seo,
  };
}

export async function getTrackDetail(db: Db, slug: string): Promise<TrackDetail | null> {
  const [row] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(and(eq(tracks.slug, slug), isNull(tracks.mergedIntoId)))
    .limit(1);
  if (!row) return null;
  const [[card], releaseMap, ratings] = await Promise.all([
    loadTrackCards(db, [row.id]),
    trackReleaseIds(db, [row.id]),
    ratingSummaries(db, "trackId", [row.id]),
  ]);
  const appearsOn = (await loadReleaseCards(db, releaseMap.get(row.id) ?? [])).map(toReleaseCard);
  return {
    ...card!,
    appearsOn,
    averageRating: ratings.get(row.id)?.average ?? null,
    ratingCount: ratings.get(row.id)?.count ?? 0,
    listenLinks: buildListenLinks(
      card!.title,
      card!.artists.map((a) => a.name),
    ),
  };
}
