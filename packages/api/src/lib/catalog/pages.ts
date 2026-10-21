import { isMainRelease } from "@spleen/catalog";
import { and, asc, desc, eq, inArray, isNotNull, schema, sql, type Db } from "@spleen/db";
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
const { releaseTracks, releases, reviews, likes, comments, tracks, userItemState } = schema;

export async function releaseIdBySlug(db: Db, slug: string) {
  const [row] = await db
    .select({
      id: releases.id,
      mbid: releases.mbid,
      tracklistImportedAt: releases.tracklistImportedAt,
    })
    .from(releases)
    .where(eq(releases.slug, slug))
    .limit(1);
  return row ?? null;
}

async function ratingDistribution(db: Db, releaseId: string): Promise<number[]> {
  const rows = await db
    .select({ rating: userItemState.rating, count: sql<number>`count(*)::int` })
    .from(userItemState)
    .where(and(eq(userItemState.releaseId, releaseId), isNotNull(userItemState.rating)))
    .groupBy(userItemState.rating);
  const distribution = Array.from({ length: 10 }, () => 0);
  for (const { rating, count } of rows) distribution[rating! - 1] = count;
  return distribution;
}

async function releaseReviews(db: Db, release: ReleaseCard): Promise<ReviewCard[]> {
  const likeCount = sql<number>`(select count(*)::int from ${likes} where ${likes.reviewId} = ${reviews.id})`;
  const commentCount = sql<number>`(select count(*)::int from ${comments} where ${comments.reviewId} = ${reviews.id})`;
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
    .where(eq(reviews.releaseId, release.id))
    .orderBy(desc(likeCount), desc(reviews.createdAt))
    .limit(REVIEWS_ON_PAGE);
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

/** Lists containing the release, with a preview of their first releases. */
async function releaseLists(db: Db, releaseId: string): Promise<ListCard[]> {
  const rows = await db
    .selectDistinct({
      id: lists.id,
      title: lists.title,
      description: lists.description,
      ranked: lists.ranked,
      updatedAt: lists.updatedAt,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(listItems)
    .innerJoin(lists, eq(lists.id, listItems.listId))
    .innerJoin(profiles, eq(profiles.userId, lists.userId))
    .where(eq(listItems.releaseId, releaseId))
    .orderBy(desc(lists.updatedAt))
    .limit(LISTS_ON_PAGE);
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

export async function getReleaseDetail(db: Db, slug: string): Promise<ReleaseDetail | null> {
  const [row] = await db.select().from(releases).where(eq(releases.slug, slug)).limit(1);
  if (!row) return null;
  const [card] = await loadReleaseCards(db, [row.id]);
  const release = toReleaseCard(card!);

  const [genreRows, trackRows, distribution, reviewCards, listCards] = await Promise.all([
    db
      .select({ name: genres.name })
      .from(releaseGenres)
      .innerJoin(genres, eq(genres.id, releaseGenres.genreId))
      .where(eq(releaseGenres.releaseId, row.id))
      .orderBy(asc(genres.name)),
    db
      .select({
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
    releaseReviews(db, release),
    releaseLists(db, row.id),
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
  };
}

export async function artistIdBySlug(db: Db, slug: string) {
  const [row] = await db
    .select({
      id: artists.id,
      mbid: artists.mbid,
      discographyImportedAt: artists.discographyImportedAt,
    })
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);
  return row ?? null;
}

/** Newest first; undated releases last. */
const byDateDesc = (a: ReleaseCardWithTypes, b: ReleaseCardWithTypes) =>
  (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "");

export async function getArtistDetail(db: Db, slug: string): Promise<ArtistDetail | null> {
  const [row] = await db.select().from(artists).where(eq(artists.slug, slug)).limit(1);
  if (!row) return null;
  const releaseIds = (
    await db
      .select({ id: releaseArtists.releaseId })
      .from(releaseArtists)
      .where(eq(releaseArtists.artistId, row.id))
  ).map((r) => r.id);
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
  };
}

export async function getTrackDetail(db: Db, slug: string): Promise<TrackDetail | null> {
  const [row] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.slug, slug))
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
