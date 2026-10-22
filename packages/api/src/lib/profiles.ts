import { and, asc, desc, eq, inArray, isNotNull, schema, sql, type Db } from "@spleen/db";
import { todayIn, type AudienceLang } from "@spleen/validators";

import type { DiaryEntry, MoodRef, ProfileDetail, ReleaseCard, ReviewCard } from "../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "./catalog/cards";
import { listRowColumns, loadListCards } from "./catalog/pages";
import { computeBaseStats } from "./stats";
import { loadStatsInput } from "./stats-source";

/*
 * Public profile page, read from the database. Privacy settings apply to everyone but the
 * member: a private diary hides the diary, recent activity and "to listen" queue; private
 * stats hide the stats. Ratings still count (anonymously) in community averages.
 */

const RECENT_SIZE = 5;
/** The diary is not paginated yet (milestone 6 adds the calendar and paging). */
const DIARY_LIMIT = 200;
const REVIEWS_LIMIT = 50;

const { comments, entries, entryMoods, favorites, follows, likes, lists, moods, profiles } = schema;
const { reviews, userItemState } = schema;

async function loadShelf(db: Db, userId: string): Promise<(ReleaseCard | null)[]> {
  const rows = await db
    .select({ position: favorites.position, releaseId: favorites.releaseId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.releaseId),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  return [1, 2, 3, 4].map((position) => {
    const row = rows.find((r) => r.position === position);
    return row ? (cards.get(row.releaseId) ?? null) : null;
  });
}

/** Dated listens, newest first, with their release (or the track's first release). */
export async function loadDiary(
  db: Db,
  userId: string,
  limit = DIARY_LIMIT,
): Promise<DiaryEntry[]> {
  const hasReview = sql<boolean>`exists (select 1 from ${reviews} where ${reviews.entryId} = ${entries.id})`;
  const rows = await db
    .select({
      id: entries.id,
      listenedOn: entries.listenedOn,
      releaseId: entries.releaseId,
      trackId: entries.trackId,
      rating: entries.rating,
      liked: entries.liked,
      relisten: entries.isRelisten,
      format: entries.format,
      hasReview,
    })
    .from(entries)
    .where(and(eq(entries.userId, userId), isNotNull(entries.listenedOn)))
    .orderBy(desc(entries.listenedOn), desc(entries.createdAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [trackCards, moodRows] = await Promise.all([
    loadTrackCards(
      db,
      rows.flatMap((r) => r.trackId ?? []),
    ),
    db
      .select({
        entryId: entryMoods.entryId,
        id: moods.id,
        slug: moods.slug,
        labelFr: moods.labelFr,
        labelEn: moods.labelEn,
        ownerId: moods.ownerId,
      })
      .from(entryMoods)
      .innerJoin(moods, eq(moods.id, entryMoods.moodId))
      .where(inArray(entryMoods.entryId, ids))
      .orderBy(asc(moods.id)),
  ]);
  const releaseCards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.flatMap((r) => r.releaseId ?? []),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const trackById = new Map(trackCards.map((t) => [t.id, t]));

  return rows.flatMap((r) => {
    const track = r.trackId ? trackById.get(r.trackId) : undefined;
    const release = r.releaseId ? releaseCards.get(r.releaseId) : track?.release;
    if (!release) return [];
    const entryMoodRefs: MoodRef[] = moodRows
      .filter((m) => m.entryId === r.id)
      .map(({ id, slug, labelFr, labelEn, ownerId }) => ({
        id,
        slug,
        labelFr,
        labelEn,
        personal: ownerId !== null,
      }));
    return {
      id: r.id,
      listenedOn: r.listenedOn!,
      release,
      track: track ? { slug: track.slug, title: track.title } : null,
      rating: r.rating,
      liked: r.liked,
      relisten: r.relisten,
      format: r.format,
      moods: entryMoodRefs,
      hasReview: r.hasReview,
    };
  });
}

async function loadReviews(db: Db, userId: string): Promise<ReviewCard[]> {
  const likeCount = sql<number>`(select count(*)::int from ${likes} where ${likes.reviewId} = ${reviews.id})`;
  const commentCount = sql<number>`(select count(*)::int from ${comments} where ${comments.reviewId} = ${reviews.id})`;
  const rows = await db
    .select({
      id: reviews.id,
      releaseId: reviews.releaseId,
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
    .where(and(eq(reviews.userId, userId), isNotNull(reviews.releaseId)))
    .orderBy(desc(reviews.createdAt))
    .limit(REVIEWS_LIMIT);
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.releaseId!),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  return rows.flatMap((r) => {
    const release = cards.get(r.releaseId!);
    if (!release) return [];
    return {
      id: r.id,
      author: { username: r.username, displayName: r.displayName },
      release,
      rating: r.rating,
      body: r.body,
      lang: r.lang as AudienceLang,
      createdAt: r.createdAt.toISOString(),
      likeCount: r.likeCount,
      commentCount: r.commentCount,
    };
  });
}

/** Releases the member wants to listen to, most recently queued first. */
export async function loadToListen(db: Db, userId: string): Promise<ReleaseCard[]> {
  const rows = await db
    .select({ releaseId: userItemState.releaseId })
    .from(userItemState)
    .where(
      and(
        eq(userItemState.userId, userId),
        eq(userItemState.wantToListen, true),
        isNotNull(userItemState.releaseId),
      ),
    )
    .orderBy(desc(userItemState.updatedAt));
  return (
    await loadReleaseCards(
      db,
      rows.map((r) => r.releaseId!),
    )
  ).map(toReleaseCard);
}

export async function getPublicProfile(
  db: Db,
  username: string,
  now: Date,
  viewerId: string | null = null,
): Promise<ProfileDetail | null> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${username.toLowerCase()}`)
    .limit(1);
  if (!row) return null;
  const userId = row.userId;
  const isOwner = viewerId === userId;
  const diaryHidden = row.diaryPrivate && !isOwner;
  const statsHidden = row.statsPrivate && !isOwner;

  const [shelf, diary, reviewCards, listRows, toListen, statsInput, followerCount, followingCount] =
    await Promise.all([
      loadShelf(db, userId),
      diaryHidden ? [] : loadDiary(db, userId),
      loadReviews(db, userId),
      db
        .select(listRowColumns)
        .from(lists)
        .innerJoin(profiles, eq(profiles.userId, lists.userId))
        .where(eq(lists.userId, userId))
        .orderBy(desc(lists.updatedAt)),
      diaryHidden ? [] : loadToListen(db, userId),
      statsHidden ? [] : loadStatsInput(db, userId),
      db.$count(follows, eq(follows.followeeId, userId)),
      db.$count(follows, eq(follows.followerId, userId)),
    ]);

  return {
    id: userId,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    joinedOn: row.createdAt.toISOString().slice(0, 10),
    followerCount,
    followingCount,
    shelf,
    recent: diary.slice(0, RECENT_SIZE),
    diary,
    reviews: reviewCards,
    lists: await loadListCards(db, listRows),
    toListen,
    stats: computeBaseStats(statsInput, Number(todayIn(row.timeZone, now).slice(0, 4))),
    diaryHidden,
    statsHidden,
  };
}
