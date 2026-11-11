import { and, desc, inArray, isNull, ne, rowsOf, schema, sql, type Db } from "@spleen/db";
import type { AudienceLang } from "@spleen/validators";

import type { CursorPage, FeedItem, MemberCard, ReviewCard } from "../../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "../catalog/cards";
import { maskRelease, ratedIds, ratedReleaseIds } from "../listening/blind";
import { countsPublicly } from "../ratings";
import type { Viewer } from "../viewer";
import { cursorInt, cursorTime, cursorUuid, decodeCursor, encodeCursor, pageOf } from "./cursor";
import { memberCards, memberRefs, notBlockedWith } from "./relations";
import { loadReviewCards } from "./reviews";

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

interface FeedRow {
  kind: "listen" | "review";
  id: string;
  at: string;
  /** A listen's latest review. */
  reviewId: string | null;
}

export async function friendsFeed(
  db: Db,
  viewer: Viewer & { id: string },
  cursor: string | undefined,
): Promise<CursorPage<FeedItem>> {
  const after = cursor ? decodeCursor(cursor, 2) : null;
  const followed = sql`select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewer.id} and ${notBlockedWith(viewer.id, follows.followeeId)}`;
  // A listen moves up when its review is written later. A review whose listen is not shown
  // (private diary, or an undated listen with no rating or heart left) stands on its own.
  const shown = sql`(${entries.listenedOn} is not null or ${entries.liked} or ${entries.rating} is not null)`;
  const result = await db.execute(sql`
    select kind, id, at::text as at, review_id as "reviewId" from (
      select 'listen' as kind, ${entries.id} as id,
        greatest(${entries.createdAt}, (select max("r"."created_at") from "reviews" "r" where "r"."entry_id" = ${entries.id} and "r"."hidden_at" is null)) as at,
        (select "r"."id" from "reviews" "r" where "r"."entry_id" = ${entries.id} and "r"."hidden_at" is null order by "r"."created_at" desc limit 1) as review_id
      from ${entries}
      join ${profiles} on ${profiles.userId} = ${entries.userId}
      where ${entries.userId} in (${followed})
        and not ${profiles.diaryPrivate}
        and ${shown}
      union all
      select 'review', ${reviews.id}, ${reviews.createdAt}, null
      from ${reviews}
      join ${profiles} on ${profiles.userId} = ${reviews.userId}
      where ${reviews.userId} in (${followed})
        and ${reviews.hiddenAt} is null
        and (${reviews.entryId} is null or ${profiles.diaryPrivate} or not exists (
          select 1 from ${entries} where ${entries.id} = ${reviews.entryId} and ${shown}))
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

/**
 * The listens of a feed page, with what they show, and the reviews' cards: two rounds of
 * queries (the rows, then everything they point to), entries and reviews side by side.
 */
async function loadFeedItems(
  db: Db,
  viewer: Viewer & { id: string },
  rows: FeedRow[],
): Promise<FeedItem[]> {
  const [listens, reviewCards] = await Promise.all([
    loadListens(
      db,
      viewer,
      rows.flatMap((r) => (r.kind === "listen" ? [r.id] : [])),
    ),
    loadReviewCards(
      db,
      rows.map((r) => (r.kind === "review" ? r.id : r.reviewId)).filter((id) => id !== null),
      viewer,
    ),
  ]);
  const reviewById = new Map(reviewCards.map((r) => [r.id, r]));
  return rows.flatMap((row): FeedItem[] => {
    if (row.kind === "review") {
      const review = reviewById.get(row.id);
      return review ? [{ kind: "review", id: row.id, at: review.createdAt, review }] : [];
    }
    const listen = listens.get(row.id);
    if (!listen) return [];
    const review = (row.reviewId && reviewById.get(row.reviewId)) || null;
    // A listen moves up when its review is written later (as in the feed query).
    const at = review && review.createdAt > listen.at ? review.createdAt : listen.at;
    return [{ ...listen, at, review }];
  });
}

/** Feed listens by entry id, without their review. Ratings follow blind listening. */
async function loadListens(
  db: Db,
  viewer: Viewer & { id: string },
  entryIds: string[],
): Promise<Map<string, Extract<FeedItem, { kind: "listen" }>>> {
  if (entryIds.length === 0) return new Map();
  const entryRows = await db.select().from(entries).where(inArray(entries.id, entryIds));
  const releaseIds = entryRows.flatMap((e) => e.releaseId ?? []);
  const trackIds = entryRows.flatMap((e) => e.trackId ?? []);
  const [authors, trackCards, releaseCards, ratedReleases, ratedTracks] = await Promise.all([
    memberRefs(
      db,
      entryRows.map((e) => e.userId),
    ),
    loadTrackCards(db, trackIds),
    loadReleaseCards(db, releaseIds),
    viewer.blind ? ratedReleaseIds(db, viewer.id, releaseIds, trackIds) : null,
    // Blind listening: track listens hide their rating until the viewer rated the track.
    viewer.blind ? ratedIds(db, viewer.id, "trackId", trackIds) : null,
  ]);
  const trackById = new Map(trackCards.map((t) => [t.id, t]));
  const releaseById = new Map(releaseCards.map((c) => [c.id, toReleaseCard(c)]));
  return new Map(
    entryRows.flatMap((entry): [string, Extract<FeedItem, { kind: "listen" }>][] => {
      const author = authors.get(entry.userId);
      const track = entry.trackId ? trackById.get(entry.trackId) : undefined;
      const card = entry.releaseId ? releaseById.get(entry.releaseId) : track?.release;
      if (!author || !card) return [];
      const release = ratedReleases ? maskRelease(ratedReleases, card) : card;
      const trackHidden = ratedTracks !== null && entry.trackId && !ratedTracks.has(entry.trackId);
      // A release listen keeps its rating hidden as long as the release's ratings are.
      const ratingHidden = trackHidden || (!track && release.ratingsHidden);
      return [
        [
          entry.id,
          {
            kind: "listen",
            id: entry.id,
            at: entry.createdAt.toISOString(),
            author,
            release,
            track: track ? { slug: track.slug, title: track.title } : null,
            listenedOn: entry.listenedOn,
            rating: ratingHidden ? null : entry.rating,
            liked: entry.liked,
            relisten: entry.isRelisten,
            review: null,
          },
        ],
      ];
    }),
  );
}

interface PopularRow {
  id: string;
  score: number;
  at: string;
}

export async function popularFeed(
  db: Db,
  viewer: Viewer,
  lang: AudienceLang,
  cursor: string | undefined,
  now: Date,
  size = FEED_PAGE_SIZE,
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
      where ${comments.deletedAt} is null and ${comments.hiddenAt} is null
        and ${comments.createdAt} >= ${since}::timestamptz
        and ${comments.userId} <> ${reviews.userId}
      group by ${comments.reviewId}
    ), scored as (
      select ${reviews.id} as id, ${reviews.createdAt} as created,
        (sum(engagement.likes) + 2 * sum(engagement.comments))::int as score
      from engagement
      join ${reviews} on ${reviews.id} = engagement.review_id
      where ${reviews.lang} = ${lang}
        and ${reviews.hiddenAt} is null
        and ${countsPublicly(reviews.userId)}
        ${viewer.id ? sql`and ${notBlockedWith(viewer.id, reviews.userId)}` : sql``}
      group by ${reviews.id}, ${reviews.createdAt}
    )
    select id, score, created::text as at from scored
    ${after ? sql`where (score, created, id) < (${cursorInt(after[0]!)}::int, ${cursorTime(after[1]!)}::timestamptz, ${cursorUuid(after[2]!)}::uuid)` : sql``}
    order by score desc, created desc, id desc
    limit ${size + 1}
  `);
  const page = pageOf(rowsOf<PopularRow>(result), size, (last) =>
    encodeCursor([last.score, last.at, last.id]),
  );
  const items = await loadReviewCards(
    db,
    page.items.map((r) => r.id),
    viewer,
  );
  return { items, nextCursor: page.nextCursor };
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
        isNull(profiles.suspendedAt),
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
