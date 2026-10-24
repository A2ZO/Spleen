import { and, eq, inArray, isNull, schema, sql, type Db, type DbOrTx } from "@spleen/db";
import type { AudienceLang, SocialSubjectInput } from "@spleen/validators";

import { fail } from "../../trpc";
import type { ReviewCard, ReviewDetail } from "../../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "../catalog/cards";
import { blindReviewCards, type BlindViewer } from "../listening/blind";
import { isBlockedBetween, memberRefs } from "./relations";

const { comments, likes, lists, profiles, reviews } = schema;

/**
 * Like and (not deleted) comment counts of a review, as select columns. Written with table
 * names: drizzle drops the qualifiers on single-table selects, and a bare "id" would then
 * mean the subquery's own table.
 */
export const reviewCountColumns = {
  likeCount: sql<number>`(select count(*)::int from "likes" where "likes"."review_id" = "reviews"."id")`,
  commentCount: sql<number>`(select count(*)::int from "comments" where "comments"."review_id" = "reviews"."id" and "comments"."deleted_at" is null)`,
};

/**
 * Review cards in the order of `ids`, for reviews of a release or of a track (shown with the
 * track's first release). `viewerId` fills `viewerLiked`. Blind listening is the caller's.
 */
export async function loadReviewCards(
  db: Db,
  ids: string[],
  viewerId: string | null,
): Promise<ReviewCard[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const [rows, liked] = await Promise.all([
    db
      .select({
        id: reviews.id,
        userId: reviews.userId,
        releaseId: reviews.releaseId,
        trackId: reviews.trackId,
        rating: reviews.rating,
        body: reviews.body,
        lang: reviews.lang,
        createdAt: reviews.createdAt,
        ...reviewCountColumns,
      })
      .from(reviews)
      .where(inArray(reviews.id, unique)),
    viewerId
      ? db
          .select({ id: likes.reviewId })
          .from(likes)
          .where(and(eq(likes.userId, viewerId), inArray(likes.reviewId, unique)))
      : [],
  ]);
  const [authors, trackCards] = await Promise.all([
    memberRefs(
      db,
      rows.map((r) => r.userId),
    ),
    loadTrackCards(
      db,
      rows.flatMap((r) => r.trackId ?? []),
    ),
  ]);
  const trackById = new Map(trackCards.map((t) => [t.id, t]));
  const releaseCards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.flatMap((r) => r.releaseId ?? []),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const likedIds = new Set(liked.map((l) => l.id));
  const byId = new Map(
    rows.flatMap((r): [string, ReviewCard][] => {
      const author = authors.get(r.userId);
      const track = r.trackId ? trackById.get(r.trackId) : undefined;
      const release = r.releaseId ? releaseCards.get(r.releaseId) : track?.release;
      if (!author || !release) return [];
      return [
        [
          r.id,
          {
            id: r.id,
            author,
            release,
            track: track ? { slug: track.slug, title: track.title } : null,
            rating: r.rating,
            body: r.body,
            lang: r.lang as AudienceLang,
            createdAt: r.createdAt.toISOString(),
            likeCount: r.likeCount,
            commentCount: r.commentCount,
            viewerLiked: likedIds.has(r.id),
          },
        ],
      ];
    }),
  );
  return unique.flatMap((id) => byId.get(id) ?? []);
}

/** A review or a list members like and comment on, with its owner. */
export interface ResolvedSubject {
  column: { reviewId: string } | { listId: string };
  ownerId: string;
}

export async function resolveSubject(
  db: DbOrTx,
  subject: SocialSubjectInput,
): Promise<ResolvedSubject> {
  if (subject.kind === "review") {
    const [row] = await db
      .select({ ownerId: reviews.userId })
      .from(reviews)
      .where(eq(reviews.id, subject.id));
    if (!row) fail("NOT_FOUND", "REVIEW_NOT_FOUND");
    return { column: { reviewId: subject.id }, ownerId: row.ownerId };
  }
  const [row] = await db
    .select({ ownerId: lists.userId })
    .from(lists)
    .where(eq(lists.id, subject.id));
  if (!row) fail("NOT_FOUND", "LIST_NOT_FOUND");
  return { column: { listId: subject.id }, ownerId: row.ownerId };
}

/** Who reads a review page: their id (null when signed out) and blind listening. */
export interface SocialViewer {
  id: string | null;
  blind: BlindViewer | null;
}

/** A review page (null when it does not exist). Ratings follow blind listening. */
export async function getReviewDetail(
  db: Db,
  id: string,
  viewer: SocialViewer,
): Promise<ReviewDetail | null> {
  const [card] = await loadReviewCards(db, [id], viewer.id);
  if (!card) return null;
  const [masked] = await blindReviewCards(db, viewer.blind, [card]);
  const [owner] = await db
    .select({ userId: reviews.userId })
    .from(reviews)
    .where(eq(reviews.id, id));
  const ownerId = owner!.userId;
  const isOwner = viewer.id === ownerId;
  let hasProfile = false;
  let blocked = false;
  if (viewer.id) {
    const [profile] = await db
      .select({ id: profiles.userId })
      .from(profiles)
      .where(eq(profiles.userId, viewer.id));
    hasProfile = profile !== undefined;
    blocked = !isOwner && (await isBlockedBetween(db, viewer.id, ownerId));
  }
  const canComment = hasProfile && !blocked;
  return {
    review: masked!,
    isOwner,
    viewerLiked: card.viewerLiked ?? false,
    canLike: canComment && !isOwner,
    canComment,
  };
}

/** Not deleted comments of a subject (SQL condition). */
export function liveCommentsOf(column: ResolvedSubject["column"]) {
  return and(
    "reviewId" in column
      ? eq(comments.reviewId, column.reviewId)
      : eq(comments.listId, column.listId),
    isNull(comments.deletedAt),
  );
}
