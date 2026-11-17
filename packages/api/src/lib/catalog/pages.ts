import { isMainRelease } from "@spleen/catalog";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  schema,
  sql,
  type Db,
  type SQL,
} from "@spleen/db";
import {
  DEFAULT_TIME_ZONE,
  todayIn,
  type AudienceLang,
  type DiscographyGroup,
} from "@spleen/validators";

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
import { upcomingRelease } from "./upcoming";
import { countsPublicly } from "../ratings";
import { notBlockedWith } from "../social/relations";
import { reviewCountColumns } from "../social/reviews";
import {
  loadReleaseCards,
  loadTrackCards,
  ratingSummaries,
  toReleaseCard,
  trackReleaseIds,
} from "./cards";

/* Item pages read from the database: catalog rows plus the community data around them. */

const REVIEWS_ON_PAGE = 10;
const LISTS_ON_PAGE = 6;
const LIST_PREVIEW_SIZE = 4;

const { artists, genres, lists, listItems, profiles, releaseArtists, releaseGenres } = schema;
const { releaseTracks, releases, reviews, tracks, userItemState } = schema;

/**
 * The stored "Listen on" links of the row, read with it (no extra round trip on a pool of 5).
 * Spelled with qualified names: single-table selects drop qualifiers (docs/pieges.md).
 */
const storedLinks = (column: "release_id" | "track_id" | "artist_id", table: string) =>
  sql<StoredLinks>`coalesce((
    select json_agg(json_build_object('service', "listen_links"."service", 'url', "listen_links"."url"))
    from "listen_links" where "listen_links".${sql.identifier(column)} = ${sql.identifier(table)}."id"
  ), '[]'::json)`.as("listen_links");

type StoredLinks = { service: string; url: string }[];
type ReleaseRow = typeof releases.$inferSelect & { listenLinks: StoredLinks };

const releaseRow = (db: Db, where: SQL | undefined) =>
  db
    .select({ row: releases, listenLinks: storedLinks("release_id", "releases") })
    .from(releases)
    .where(where)
    .limit(1)
    .then(([found]): ReleaseRow | null =>
      found ? { ...found.row, listenLinks: found.listenLinks } : null,
    );

/** The release row behind a slug (merged releases left out), reused by `getReleaseDetail`. */
export function releaseIdBySlug(db: Db, slug: string): Promise<ReleaseRow | null> {
  return releaseRow(db, and(eq(releases.slug, slug), isNull(releases.mergedIntoId)));
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
  now: Date,
  known?: ReleaseRow,
): Promise<ReleaseDetail | null> {
  const row = known ?? (await releaseRow(db, eq(releases.slug, slug)));
  if (!row) return null;
  const card = loadReleaseCards(db, [row.id]).then(([c]) => toReleaseCard(c!));

  const [release, genreRows, trackRows, distribution, reviewCards, listCards, seo, upcoming] =
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
      upcomingRelease(db, row.id, todayIn(DEFAULT_TIME_ZONE, now)),
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
    listenLinks: buildListenLinks(row.listenLinks, "release", row.title, release.artists[0]?.name),
    seo,
    upcoming,
  };
}

type ArtistRow = typeof artists.$inferSelect & { listenLinks: StoredLinks };

const artistRow = (db: Db, where: SQL | undefined) =>
  db
    .select({ row: artists, listenLinks: storedLinks("artist_id", "artists") })
    .from(artists)
    .where(where)
    .limit(1)
    .then(([found]): ArtistRow | null =>
      found ? { ...found.row, listenLinks: found.listenLinks } : null,
    );

/** The artist row behind a slug (merged artists left out), reused by `getArtistDetail`. */
export function artistIdBySlug(db: Db, slug: string): Promise<ArtistRow | null> {
  return artistRow(db, and(eq(artists.slug, slug), isNull(artists.mergedIntoId)));
}

/** Releases shown per discography group before "see all". */
export const DISCOGRAPHY_PREVIEW = 12;

/** Newest first; undated releases last. */
const byDateDesc = (a: { releaseDate: string | null }, b: { releaseDate: string | null }) =>
  (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "");

function discographyGroup(r: { type: string; secondaryTypes: string[] }): DiscographyGroup | null {
  if (!isMainRelease(r.secondaryTypes)) return "other";
  if (r.type === "album") return "albums";
  if (r.type === "ep") return "eps";
  if (r.type === "single") return "singles";
  return null;
}

/**
 * `known`: the row `artistIdBySlug` already read. The search metadata comes in parallel. Each
 * group keeps its newest `DISCOGRAPHY_PREVIEW` releases (all of them for `all`): cards, artists
 * and ratings are loaded for those only, the rest is counted from one light query.
 */
export async function getArtistDetail(
  db: Db,
  slug: string,
  known?: ArtistRow,
  all?: DiscographyGroup,
): Promise<ArtistDetail | null> {
  const row = known ?? (await artistRow(db, eq(artists.slug, slug)));
  if (!row) return null;
  const [releaseRows, seo] = await Promise.all([
    db
      .select({
        id: releases.id,
        type: releases.type,
        secondaryTypes: releases.secondaryTypes,
        releaseDate: releases.releaseDate,
      })
      .from(releaseArtists)
      .innerJoin(releases, eq(releases.id, releaseArtists.releaseId))
      .where(eq(releaseArtists.artistId, row.id)),
    seoPage(db, "artist", row.slug),
  ]);
  const groups: Record<DiscographyGroup, string[]> = {
    albums: [],
    eps: [],
    singles: [],
    other: [],
  };
  for (const release of releaseRows.sort(byDateDesc)) {
    const group = discographyGroup(release);
    if (group) groups[group].push(release.id);
  }
  const shown = (group: DiscographyGroup) =>
    group === all ? groups[group] : groups[group].slice(0, DISCOGRAPHY_PREVIEW);
  const cards = new Map(
    (
      await loadReleaseCards(db, [
        ...shown("albums"),
        ...shown("eps"),
        ...shown("singles"),
        ...shown("other"),
      ])
    ).map((card) => [card.id, toReleaseCard(card)]),
  );
  const ofGroup = (group: DiscographyGroup): ReleaseCard[] =>
    shown(group).flatMap((id) => cards.get(id) ?? []);

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
      albums: ofGroup("albums"),
      eps: ofGroup("eps"),
      singles: ofGroup("singles"),
      other: ofGroup("other"),
    },
    discographyTotals: {
      albums: groups.albums.length,
      eps: groups.eps.length,
      singles: groups.singles.length,
      other: groups.other.length,
    },
    listenLinks: buildListenLinks(row.listenLinks, "artist", "", row.name),
    seo,
  };
}

export async function getTrackDetail(db: Db, slug: string): Promise<TrackDetail | null> {
  const [row] = await db
    .select({ id: tracks.id, listenLinks: storedLinks("track_id", "tracks") })
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
    listenLinks: buildListenLinks(row.listenLinks, "track", card!.title, card!.artists[0]?.name),
  };
}
