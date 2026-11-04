import { and, eq, inArray, isNull, or, schema, sql, type Db, type DbOrTx } from "@spleen/db";
import type { AudienceLang, SocialSubjectInput } from "@spleen/validators";

import { fail } from "../../trpc";
import type { ReviewCard, ReviewDetail } from "../../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "../catalog/cards";
import { maskReviewCard, ratedReleaseIds } from "../listening/blind";
import { moderationHold } from "../moderation/holds";
import type { Viewer } from "../viewer";
import { isBlockedBetween, memberRefs, notBlockedWith } from "./relations";

const { comments, likes, lists, profiles, reviews } = schema;

/**
 * Like and (not deleted) comment counts of a review, as select columns. Written with table
 * names: drizzle drops the qualifiers on single-table selects, and a bare "id" would then
 * mean the subquery's own table. With a viewer, comments hidden from them (members blocked
 * either way, unless the viewer owns the review) are not counted, as in `listComments`.
 */
export function reviewCountColumns(viewerId: string | null) {
  const visible = viewerId
    ? sql`and ("reviews"."user_id" = ${viewerId} or ${notBlockedWith(viewerId, sql`"comments"."user_id"`)})`
    : sql``;
  return {
    likeCount: sql<number>`(select count(*)::int from "likes" where "likes"."review_id" = "reviews"."id")`,
    commentCount: sql<number>`(select count(*)::int from "comments" where "comments"."review_id" = "reviews"."id" and "comments"."deleted_at" is null and "comments"."hidden_at" is null ${visible})`,
  };
}

/**
 * Review cards in the order of `ids`, for reviews of a release or of a track (shown with the
 * track's first release). `viewer.id` fills `viewerLiked`; ratings follow blind listening.
 * Two rounds of queries: the reviews, then everything they point to at once. Hidden reviews
 * and those of suspended members are left out; with `ownHidden`, the viewer's own hidden
 * reviews stay (marked `hidden`).
 */
export async function loadReviewCards(
  db: Db,
  ids: string[],
  viewer: Viewer,
  options: { ownHidden?: boolean } = {},
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
        hiddenAt: reviews.hiddenAt,
        ...reviewCountColumns(viewer.id),
      })
      .from(reviews)
      .where(
        and(inArray(reviews.id, unique), visibleTo(reviews, options.ownHidden ? viewer.id : null)),
      ),
    viewer.id
      ? db
          .select({ id: likes.reviewId })
          .from(likes)
          .where(and(eq(likes.userId, viewer.id), inArray(likes.reviewId, unique)))
      : [],
  ]);
  const releaseIds = rows.flatMap((r) => r.releaseId ?? []);
  const trackIds = rows.flatMap((r) => r.trackId ?? []);
  const [authors, trackCards, releaseCards, rated] = await Promise.all([
    memberRefs(
      db,
      rows.map((r) => r.userId),
    ),
    loadTrackCards(db, trackIds),
    loadReleaseCards(db, releaseIds),
    viewer.blind ? ratedReleaseIds(db, viewer.blind.userId, releaseIds, trackIds) : null,
  ]);
  const trackById = new Map(trackCards.map((t) => [t.id, t]));
  const releaseById = new Map(releaseCards.map((c) => [c.id, toReleaseCard(c)]));
  const likedIds = new Set(liked.map((l) => l.id));
  const byId = new Map(
    rows.flatMap((r): [string, ReviewCard][] => {
      const author = authors.get(r.userId);
      const track = r.trackId ? trackById.get(r.trackId) : undefined;
      const release = r.releaseId ? releaseById.get(r.releaseId) : track?.release;
      if (!author || !release) return [];
      const card: ReviewCard = {
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
        ...(r.hiddenAt && { hidden: true }),
      };
      return [[r.id, rated ? maskReviewCard(rated, card) : card]];
    }),
  );
  return unique.flatMap((id) => byId.get(id) ?? []);
}

/**
 * Not hidden by moderation, or the reader's own (SQL condition): hidden content is invisible to
 * everyone but its author. `readerId` null: not hidden, for everyone.
 */
export function visibleTo(
  table: typeof reviews | typeof lists | typeof comments,
  readerId: string | null,
) {
  return readerId ? or(isNull(table.hiddenAt), eq(table.userId, readerId)) : isNull(table.hiddenAt);
}

/** A review or a list members like and comment on, with its owner. */
export interface ResolvedSubject {
  column: { reviewId: string } | { listId: string };
  ownerId: string;
  /** Hidden by moderation: only returned to its owner, who may still read it. */
  hidden: boolean;
}

/**
 * Hidden content is "not found", except for its owner when `readerId` is given (reading only:
 * nobody likes or comments it any more, its owner included).
 */
export async function resolveSubject(
  db: DbOrTx,
  subject: SocialSubjectInput,
  readerId: string | null = null,
): Promise<ResolvedSubject> {
  if (subject.kind === "review") {
    const [row] = await db
      .select({ ownerId: reviews.userId, hiddenAt: reviews.hiddenAt })
      .from(reviews)
      .where(and(eq(reviews.id, subject.id), visibleTo(reviews, readerId)));
    if (!row) fail("NOT_FOUND", "REVIEW_NOT_FOUND");
    return { column: { reviewId: subject.id }, ownerId: row.ownerId, hidden: !!row.hiddenAt };
  }
  const [row] = await db
    .select({ ownerId: lists.userId, hiddenAt: lists.hiddenAt })
    .from(lists)
    .where(and(eq(lists.id, subject.id), visibleTo(lists, readerId)));
  if (!row) fail("NOT_FOUND", "LIST_NOT_FOUND");
  return { column: { listId: subject.id }, ownerId: row.ownerId, hidden: !!row.hiddenAt };
}

/**
 * A review page (null when it does not exist). Ratings follow blind listening. A review hidden
 * by moderation is shown to its author alone, with the reason and no likes nor comments.
 */
export async function getReviewDetail(
  db: Db,
  id: string,
  viewer: Viewer,
  contactEmail: string | null,
): Promise<ReviewDetail | null> {
  const [[card], [owner], hasProfile] = await Promise.all([
    loadReviewCards(db, [id], viewer, { ownHidden: true }),
    db.select({ userId: reviews.userId }).from(reviews).where(eq(reviews.id, id)),
    viewer.id
      ? db
          .select({ id: profiles.userId })
          .from(profiles)
          .where(eq(profiles.userId, viewer.id))
          .then((rows) => rows.length > 0)
      : false,
  ]);
  if (!card || !owner) return null;
  const isOwner = viewer.id === owner.userId;
  const blocked = !!viewer.id && !isOwner && (await isBlockedBetween(db, viewer.id, owner.userId));
  const hidden = await moderationHold(db, "reviewId", id, !!card.hidden, contactEmail);
  const canComment = hasProfile && !blocked && !hidden;
  return {
    review: card,
    isOwner,
    viewerLiked: card.viewerLiked ?? false,
    canLike: canComment && !isOwner,
    canComment,
    hidden,
  };
}

/** Not deleted (nor hidden, except the reader's own) comments of a subject (SQL condition). */
export function liveCommentsOf(column: ResolvedSubject["column"], readerId: string | null = null) {
  return and(
    "reviewId" in column
      ? eq(comments.reviewId, column.reviewId)
      : eq(comments.listId, column.listId),
    isNull(comments.deletedAt),
    visibleTo(comments, readerId),
  );
}
