import { and, eq, inArray, isNotNull, schema, type Db } from "@spleen/db";

import type { SessionUser } from "../../trpc";
import type {
  ArtistDetail,
  CatalogSearchResults,
  ReleaseCard,
  ReleaseDetail,
  ReviewCard,
  TrackCard,
  TrackDetail,
} from "../../types";

/*
 * Blind listening: a member who turned it on does not see the community ratings of an item
 * until they have rated it themselves. Applied by the API, so every client gets it.
 */

const { profiles, userItemState } = schema;

/** A signed-in member with blind listening on (null: nothing is hidden). */
export interface BlindViewer {
  userId: string;
}

export async function blindViewer(db: Db, user: SessionUser | null): Promise<BlindViewer | null> {
  if (!user) return null;
  const [row] = await db
    .select({ blindMode: profiles.blindMode })
    .from(profiles)
    .where(eq(profiles.userId, user.id));
  return row?.blindMode ? { userId: user.id } : null;
}

/** Ids among `ids` the member has rated. */
export async function ratedIds(
  db: Db,
  userId: string,
  column: "releaseId" | "trackId",
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const target = userItemState[column];
  const rows = await db
    .select({ id: target })
    .from(userItemState)
    .where(
      and(eq(userItemState.userId, userId), inArray(target, ids), isNotNull(userItemState.rating)),
    );
  return new Set(rows.map((r) => r.id!));
}

/** Returns a function hiding the ratings of the releases the viewer has not rated. */
async function releaseMasker(db: Db, viewer: BlindViewer, cards: ReleaseCard[]) {
  const rated = await ratedIds(
    db,
    viewer.userId,
    "releaseId",
    cards.map((c) => c.id),
  );
  return <T extends ReleaseCard>(card: T): T =>
    rated.has(card.id)
      ? card
      : { ...card, averageRating: null, ratingCount: 0, ratingsHidden: true };
}

export async function blindReleaseDetail(
  db: Db,
  viewer: BlindViewer | null,
  detail: ReleaseDetail,
): Promise<ReleaseDetail> {
  if (!viewer) return detail;
  const previews = detail.lists.flatMap((l) => l.preview);
  const mask = await releaseMasker(db, viewer, [detail, ...previews]);
  const masked = mask(detail);
  const hidden = masked.ratingsHidden === true;
  return {
    ...masked,
    ratingDistribution: hidden ? detail.ratingDistribution.map(() => 0) : detail.ratingDistribution,
    reviews: hidden
      ? detail.reviews.map((r) => ({ ...r, rating: null, release: mask(r.release) }))
      : detail.reviews,
    lists: detail.lists.map((l) => ({ ...l, preview: l.preview.map(mask) })),
  };
}

export async function blindArtistDetail(
  db: Db,
  viewer: BlindViewer | null,
  detail: ArtistDetail,
): Promise<ArtistDetail> {
  if (!viewer) return detail;
  const { albums, eps, singles, other } = detail.discography;
  const mask = await releaseMasker(db, viewer, [...albums, ...eps, ...singles, ...other]);
  return {
    ...detail,
    discography: {
      albums: albums.map(mask),
      eps: eps.map(mask),
      singles: singles.map(mask),
      other: other.map(mask),
    },
  };
}

async function trackCardsMasker(db: Db, viewer: BlindViewer, tracks: TrackCard[]) {
  const mask = await releaseMasker(
    db,
    viewer,
    tracks.flatMap((t) => t.release ?? []),
  );
  return <T extends TrackCard>(track: T): T => ({
    ...track,
    release: track.release ? mask(track.release) : null,
  });
}

export async function blindTrackDetail(
  db: Db,
  viewer: BlindViewer | null,
  detail: TrackDetail,
): Promise<TrackDetail> {
  if (!viewer) return detail;
  const [rated, maskTrack, maskRelease] = await Promise.all([
    ratedIds(db, viewer.userId, "trackId", [detail.id]),
    trackCardsMasker(db, viewer, [detail]),
    releaseMasker(db, viewer, detail.appearsOn),
  ]);
  const own = rated.has(detail.id);
  return {
    ...maskTrack(detail),
    appearsOn: detail.appearsOn.map(maskRelease),
    ...(own ? {} : { averageRating: null, ratingCount: 0, ratingsHidden: true }),
  };
}

export async function blindSearchResults(
  db: Db,
  viewer: BlindViewer | null,
  results: CatalogSearchResults,
): Promise<CatalogSearchResults> {
  if (!viewer) return results;
  const [maskRelease, maskTrack] = await Promise.all([
    releaseMasker(db, viewer, results.releases),
    trackCardsMasker(db, viewer, results.tracks),
  ]);
  return {
    ...results,
    releases: results.releases.map(maskRelease),
    tracks: results.tracks.map(maskTrack),
  };
}

/** Masks release cards anywhere in a list of items (profile sections). */
export async function blindReleaseItems<T>(
  db: Db,
  viewer: BlindViewer | null,
  items: T[],
  releaseOf: (item: T) => ReleaseCard | null,
  withRelease: (item: T, release: ReleaseCard) => T,
): Promise<T[]> {
  if (!viewer) return items;
  const mask = await releaseMasker(
    db,
    viewer,
    items.flatMap((item) => releaseOf(item) ?? []),
  );
  return items.map((item) => {
    const release = releaseOf(item);
    return release ? withRelease(item, mask(release)) : item;
  });
}

/** Review cards: the review's rating is hidden too while the viewer has not rated the release. */
export function blindReviewCards(
  db: Db,
  viewer: BlindViewer | null,
  reviews: ReviewCard[],
): Promise<ReviewCard[]> {
  return blindReleaseItems(
    db,
    viewer,
    reviews,
    (r) => r.release,
    (r, release) => ({ ...r, release, rating: release.ratingsHidden ? null : r.rating }),
  );
}
