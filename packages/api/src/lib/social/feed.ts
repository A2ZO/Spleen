import { and, desc, inArray, ne, schema, sql, type Db } from "@spleen/db";
import type { AudienceLang } from "@spleen/validators";

import type { CursorPage, FeedItem, MemberCard, ReleaseCard, ReviewCard } from "../../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "../catalog/cards";
import { blindReleaseItems, blindReviewCards, ratedIds } from "../listening/blind";
import { cursorTime, cursorUuid, decodeCursor, encodeCursor, pageOf } from "./cursor";
import { memberCards, memberRefs, notBlockedWith } from "./relations";
import { loadReviewCards, type SocialViewer } from "./reviews";

/*
 * The home feed. "Friends": listens (with their review), hearts, quick ratings and reviews
 * of the members the viewer follows, newest first. A private diary keeps its listens out
 * (the reviews stay public, as on the profile). "Popular": reviews in one language ranked
 * by the likes and comments (2 points each, the author's own excluded) they received in the
 * last 7 days. Both use keyset cursors; blind listening hides the ratings of items the
 * viewer has not rated.
 */

const { comments, entries, follows, likes, profiles, reviews } = schema;

export const FEED_PAGE_SIZE = 20;
export const POPULAR_WINDOW_DAYS = 7;
const SUGGESTIONS_SIZE = 5;
const ACTIVE_WINDOW_DAYS = 30;

const rowsOf = <T>(result: unknown) =>
  (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];

interface FeedRow {
  kind: "listen" | "review";
  id: string;
  at: string;
}

export async function friendsFeed(
  db: Db,
  viewer: SocialViewer & { id: string },
  cursor: string | undefined,
): Promise<CursorPage<FeedItem>> {
  const after = cursor ? decodeCursor(cursor, 2) : null;
  const followed = sql`select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewer.id} and ${notBlockedWith(viewer.id, follows.followeeId)}`;
  const result = await db.execute(sql`
    select kind, id, at::text as at from (
      select 'listen' as kind, ${entries.id} as id, ${entries.createdAt} as at
      from ${entries}
      join ${profiles} on ${profiles.userId} = ${entries.userId}
      where ${entries.userId} in (${followed})
        and not ${profiles.diaryPrivate}
        and (${entries.listenedOn} is not null or ${entries.liked} or ${entries.rating} is not null)
      union all
      select 'review', ${reviews.id}, ${reviews.createdAt}
      from ${reviews}
      join ${profiles} on ${profiles.userId} = ${reviews.userId}
      where ${reviews.userId} in (${followed})
        and (${reviews.entryId} is null or ${profiles.diaryPrivate})
    ) items
    ${after ? sql`where (at, id) < (${cursorTime(after[0]!)}::timestamptz, ${cursorUuid(after[1]!)}::uuid)` : sql``}
    order by at desc, id desc
    limit ${FEED_PAGE_SIZE + 1}
  `);
  const page = pageOf(rowsOf<FeedRow>(result), FEED_PAGE_SIZE, (last) =>
    encodeCursor([last.at, last.id]),
  );
  return { items: await loadFeedItems(db, viewer, page.items), nextCursor: page.nextCursor };
}

async function loadFeedItems(
  db: Db,
  viewer: SocialViewer & { id: string },
  rows: FeedRow[],
): Promise<FeedItem[]> {
  const entryIds = rows.filter((r) => r.kind === "listen").map((r) => r.id);
  const entryRows = entryIds.length
    ? await db.select().from(entries).where(inArray(entries.id, entryIds))
    : [];
  const entryReviews = entryIds.length
    ? await db
        .select({ id: reviews.id, entryId: reviews.entryId })
        .from(reviews)
        .where(inArray(reviews.entryId, entryIds))
        .orderBy(desc(reviews.createdAt))
    : [];
  const reviewIds = [
    ...rows.filter((r) => r.kind === "review").map((r) => r.id),
    ...entryReviews.map((r) => r.id),
  ];
  const [authors, trackCards, reviewCards] = await Promise.all([
    memberRefs(
      db,
      entryRows.map((e) => e.userId),
    ),
    loadTrackCards(
      db,
      entryRows.flatMap((e) => e.trackId ?? []),
    ),
    loadReviewCards(db, reviewIds, viewer.id).then((cards) =>
      blindReviewCards(db, viewer.blind, cards),
    ),
  ]);
  const releaseCards = new Map(
    (
      await loadReleaseCards(
        db,
        entryRows.flatMap((e) => e.releaseId ?? []),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const trackById = new Map(trackCards.map((t) => [t.id, t]));
  const reviewById = new Map(reviewCards.map((r) => [r.id, r]));
  const reviewOfEntry = new Map<string, ReviewCard>();
  for (const { id, entryId } of entryReviews) {
    const card = reviewById.get(id);
    if (card && entryId && !reviewOfEntry.has(entryId)) reviewOfEntry.set(entryId, card);
  }
  // Blind listening: track listens hide their rating until the viewer rated the track.
  const ratedTracks = viewer.blind
    ? await ratedIds(
        db,
        viewer.id,
        "trackId",
        entryRows.flatMap((e) => e.trackId ?? []),
      )
    : null;
  const entryById = new Map(entryRows.map((e) => [e.id, e]));

  const items = rows.flatMap((row): FeedItem[] => {
    if (row.kind === "review") {
      const review = reviewById.get(row.id);
      return review ? [{ kind: "review", id: row.id, at: review.createdAt, review }] : [];
    }
    const entry = entryById.get(row.id);
    const author = entry && authors.get(entry.userId);
    if (!entry || !author) return [];
    const track = entry.trackId ? trackById.get(entry.trackId) : undefined;
    const release = entry.releaseId ? releaseCards.get(entry.releaseId) : track?.release;
    if (!release) return [];
    const trackHidden = ratedTracks !== null && entry.trackId && !ratedTracks.has(entry.trackId);
    return [
      {
        kind: "listen",
        id: entry.id,
        at: entry.createdAt.toISOString(),
        author,
        release,
        track: track ? { slug: track.slug, title: track.title } : null,
        listenedOn: entry.listenedOn,
        rating: trackHidden ? null : entry.rating,
        liked: entry.liked,
        relisten: entry.isRelisten,
        review: reviewOfEntry.get(entry.id) ?? null,
      },
    ];
  });
  const masked = await blindReleaseItems(
    db,
    viewer.blind,
    items,
    (item): ReleaseCard | null => (item.kind === "listen" ? item.release : null),
    (item, release) => (item.kind === "listen" ? { ...item, release } : item),
  );
  // A release listen keeps its rating hidden as long as the release's ratings are.
  return masked.map((item) =>
    item.kind === "listen" && !item.track && item.release.ratingsHidden
      ? { ...item, rating: null }
      : item,
  );
}

interface PopularRow {
  id: string;
  score: number;
  at: string;
}

export async function popularFeed(
  db: Db,
  viewer: SocialViewer,
  lang: AudienceLang,
  cursor: string | undefined,
  now: Date,
): Promise<CursorPage<ReviewCard>> {
  const after = cursor ? decodeCursor(cursor, 3) : null;
  // ISO text, not a Date: postgres.js only serialises Dates for typed columns, not raw SQL.
  const since = new Date(now.getTime() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute(sql`
    with engagement as (
      select ${likes.reviewId} as review_id, count(*)::int as likes, 0 as comments
      from ${likes}
      where ${likes.reviewId} is not null and ${likes.createdAt} >= ${since}::timestamptz
      group by ${likes.reviewId}
      union all
      select ${comments.reviewId}, 0, count(*)::int
      from ${comments}
      join ${reviews} on ${reviews.id} = ${comments.reviewId}
      where ${comments.deletedAt} is null and ${comments.createdAt} >= ${since}::timestamptz
        and ${comments.userId} <> ${reviews.userId}
      group by ${comments.reviewId}
    ), scored as (
      select ${reviews.id} as id, ${reviews.createdAt} as created,
        (sum(engagement.likes) + 2 * sum(engagement.comments))::int as score
      from engagement
      join ${reviews} on ${reviews.id} = engagement.review_id
      where ${reviews.lang} = ${lang}
        ${viewer.id ? sql`and ${notBlockedWith(viewer.id, reviews.userId)}` : sql``}
      group by ${reviews.id}, ${reviews.createdAt}
    )
    select id, score, created::text as at from scored
    ${after ? sql`where (score, created, id) < (${Number(after[0])}::int, ${cursorTime(after[1]!)}::timestamptz, ${cursorUuid(after[2]!)}::uuid)` : sql``}
    order by score desc, created desc, id desc
    limit ${FEED_PAGE_SIZE + 1}
  `);
  const page = pageOf(rowsOf<PopularRow>(result), FEED_PAGE_SIZE, (last) =>
    encodeCursor([last.score, last.at, last.id]),
  );
  const cards = await loadReviewCards(
    db,
    page.items.map((r) => r.id),
    viewer.id,
  );
  return { items: await blindReviewCards(db, viewer.blind, cards), nextCursor: page.nextCursor };
}

/**
 * Members to discover when the friends feed is empty: the most active of the last 30 days
 * (listens and reviews), not followed yet, no block either way.
 */
export async function suggestedMembers(db: Db, viewerId: string, now: Date): Promise<MemberCard[]> {
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Table names spelled out: drizzle drops the qualifiers on single-table selects, and
  // "user_id" inside these subqueries would then mean their own table's column.
  const member = sql`"profiles"."user_id"`;
  const activity = sql<number>`(
    (select count(*) from "entries" where "entries"."user_id" = ${member} and "entries"."created_at" >= ${since}::timestamptz)
    + (select count(*) from "reviews" where "reviews"."user_id" = ${member} and "reviews"."created_at" >= ${since}::timestamptz)
  )::int`;
  const followers = sql<number>`(select count(*)::int from "follows" where "follows"."followee_id" = ${member})`;
  const rows = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(
      and(
        ne(profiles.userId, viewerId),
        notBlockedWith(viewerId, member),
        sql`not exists (select 1 from "follows" where "follows"."follower_id" = ${viewerId} and "follows"."followee_id" = ${member})`,
        sql`exists (select 1 from "entries" where "entries"."user_id" = ${member})`,
      ),
    )
    .orderBy(desc(activity), desc(followers), profiles.username)
    .limit(SUGGESTIONS_SIZE);
  return memberCards(
    db,
    rows.map((r) => r.userId),
    viewerId,
  );
}
