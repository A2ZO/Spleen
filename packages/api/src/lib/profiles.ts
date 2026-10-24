import { and, asc, desc, eq, gte, inArray, isNotNull, lt, schema, sql, type Db } from "@spleen/db";
import type { AudienceLang } from "@spleen/validators";

import type {
  DiaryEntry,
  LikedRelease,
  ListCard,
  MemberStats,
  MoodRef,
  Page,
  ProfileDetail,
  ReleaseCard,
  ReviewCard,
} from "../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "./catalog/cards";
import { listRowColumns, loadListCards } from "./catalog/pages";
import { blindReleaseItems, blindReviewCards, type BlindViewer } from "./listening/blind";
import { getShelf } from "./shelf";
import { getMemberStats } from "./stats";

/*
 * Public profile, read from the database. The header (`getPublicProfile`) and each section
 * (diary, calendar, hearts, reviews, queue, lists, stats) are separate calls so that pages
 * only load what they show. Privacy settings apply to everyone but the member: a private
 * diary hides the diary, calendar, recent activity, hearts and "to listen" queue; private
 * stats hide the stats. Ratings still count (anonymously) in community averages.
 * Blind listening applies to every release card and review rating shown to the viewer.
 */

const RECENT_SIZE = 5;
export const DIARY_PAGE_SIZE = 30;
export const LIKES_PAGE_SIZE = 24;
export const REVIEWS_PAGE_SIZE = 20;
export const TO_LISTEN_PAGE_SIZE = 24;
/** A month of listens on the calendar; beyond that, the list view has them all. */
const MONTH_LIMIT = 500;

const { comments, entries, entryMoods, follows, likes, lists, moods, profiles } = schema;
const { reviews, userItemState } = schema;

/** Who looks at the profile: their id (null when signed out) and blind listening. */
export interface ProfileViewer {
  id: string | null;
  blind: BlindViewer | null;
}

interface ProfileAccess {
  row: typeof profiles.$inferSelect;
  userId: string;
  isOwner: boolean;
  diaryHidden: boolean;
  statsHidden: boolean;
}

async function findProfile(
  db: Db,
  username: string,
  viewer: ProfileViewer,
): Promise<ProfileAccess | null> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${username.toLowerCase()}`)
    .limit(1);
  if (!row) return null;
  const isOwner = viewer.id === row.userId;
  return {
    row,
    userId: row.userId,
    isOwner,
    diaryHidden: row.diaryPrivate && !isOwner,
    statsHidden: row.statsPrivate && !isOwner,
  };
}

function toPage<T>(items: T[], page: number, size: number, total: number): Page<T> {
  return { items, page, pageCount: Math.max(1, Math.ceil(total / size)), total };
}

const emptyPage = <T>(page: number): Page<T> => ({ items: [], page, pageCount: 1, total: 0 });

const maskDiary = (db: Db, viewer: ProfileViewer, items: DiaryEntry[]) =>
  blindReleaseItems(
    db,
    viewer.blind,
    items,
    (e) => e.release,
    (e, release) => ({ ...e, release }),
  );

const maskCards = (db: Db, viewer: ProfileViewer, cards: ReleaseCard[]) =>
  blindReleaseItems(
    db,
    viewer.blind,
    cards,
    (c) => c,
    (_, release) => release,
  );

/** Dated listens (undated ones are never in the diary), with their release or the track's. */
async function loadDiaryEntries(
  db: Db,
  where: ReturnType<typeof and>,
  options: { order: "newest" | "oldest"; limit: number; offset?: number },
): Promise<DiaryEntry[]> {
  const hasReview = sql<boolean>`exists (select 1 from ${reviews} where ${reviews.entryId} = ${entries.id})`;
  const dir = options.order === "newest" ? desc : asc;
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
    .where(and(where, isNotNull(entries.listenedOn)))
    .orderBy(dir(entries.listenedOn), dir(entries.createdAt), dir(entries.id))
    .limit(options.limit)
    .offset(options.offset ?? 0);
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

export async function getPublicProfile(
  db: Db,
  username: string,
  viewer: ProfileViewer,
): Promise<ProfileDetail | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  const { row, userId } = access;
  const [shelf, recent, followerCount, followingCount] = await Promise.all([
    getShelf(db, userId),
    access.diaryHidden
      ? []
      : loadDiaryEntries(db, eq(entries.userId, userId), { order: "newest", limit: RECENT_SIZE }),
    db.$count(follows, eq(follows.followeeId, userId)),
    db.$count(follows, eq(follows.followerId, userId)),
  ]);
  const shelfCards = await maskCards(
    db,
    viewer,
    shelf.flatMap((c) => c ?? []),
  );
  const masked = new Map(shelfCards.map((c) => [c.id, c]));

  return {
    id: userId,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    joinedOn: row.createdAt.toISOString().slice(0, 10),
    followerCount,
    followingCount,
    shelf: shelf.map((c) => (c ? (masked.get(c.id) ?? c) : null)),
    recent: await maskDiary(db, viewer, recent),
    isOwner: access.isOwner,
    diaryHidden: access.diaryHidden,
    statsHidden: access.statsHidden,
  };
}

/** Diary, list view: dated listens, newest first. */
export async function getDiaryPage(
  db: Db,
  username: string,
  viewer: ProfileViewer,
  page: number,
): Promise<Page<DiaryEntry> | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  if (access.diaryHidden) return emptyPage(page);
  const where = and(eq(entries.userId, access.userId), isNotNull(entries.listenedOn));
  const [items, total] = await Promise.all([
    loadDiaryEntries(db, where, {
      order: "newest",
      limit: DIARY_PAGE_SIZE,
      offset: (page - 1) * DIARY_PAGE_SIZE,
    }),
    db.$count(entries, where),
  ]);
  return toPage(await maskDiary(db, viewer, items), page, DIARY_PAGE_SIZE, total);
}

/** First day of the month after `month` ("2026-12" → "2027-01-01"). */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Diary, calendar view: dated listens of one month, oldest first. */
export async function getDiaryMonth(
  db: Db,
  username: string,
  viewer: ProfileViewer,
  month: string,
): Promise<DiaryEntry[] | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  if (access.diaryHidden) return [];
  const where = and(
    eq(entries.userId, access.userId),
    gte(entries.listenedOn, `${month}-01`),
    lt(entries.listenedOn, nextMonthStart(month)),
  );
  const items = await loadDiaryEntries(db, where, { order: "oldest", limit: MONTH_LIMIT });
  return maskDiary(db, viewer, items);
}

/** Hearted releases, most recently hearted first. */
export async function getLikesPage(
  db: Db,
  username: string,
  viewer: ProfileViewer,
  page: number,
): Promise<Page<LikedRelease> | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  if (access.diaryHidden) return emptyPage(page);
  const where = and(
    eq(userItemState.userId, access.userId),
    eq(userItemState.liked, true),
    isNotNull(userItemState.releaseId),
  );
  const [rows, total] = await Promise.all([
    db
      .select({ releaseId: userItemState.releaseId, likedAt: userItemState.likedAt })
      .from(userItemState)
      .where(where)
      .orderBy(desc(userItemState.likedAt), desc(userItemState.id))
      .limit(LIKES_PAGE_SIZE)
      .offset((page - 1) * LIKES_PAGE_SIZE),
    db.$count(userItemState, where),
  ]);
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.releaseId!),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const items = rows.flatMap((r) => {
    const release = cards.get(r.releaseId!);
    // likedAt is set with every heart; the fallback only covers rows from before it existed.
    return release ? { release, likedAt: (r.likedAt ?? new Date(0)).toISOString() } : [];
  });
  const masked = await blindReleaseItems(
    db,
    viewer.blind,
    items,
    (i) => i.release,
    (i, release) => ({ ...i, release }),
  );
  return toPage(masked, page, LIKES_PAGE_SIZE, total);
}

/** The member's reviews of releases, newest first. */
export async function getReviewsPage(
  db: Db,
  username: string,
  viewer: ProfileViewer,
  page: number,
): Promise<Page<ReviewCard> | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  const where = and(eq(reviews.userId, access.userId), isNotNull(reviews.releaseId));
  const likeCount = sql<number>`(select count(*)::int from ${likes} where ${likes.reviewId} = ${reviews.id})`;
  const commentCount = sql<number>`(select count(*)::int from ${comments} where ${comments.reviewId} = ${reviews.id})`;
  const [rows, total] = await Promise.all([
    db
      .select({
        id: reviews.id,
        releaseId: reviews.releaseId,
        rating: reviews.rating,
        body: reviews.body,
        lang: reviews.lang,
        createdAt: reviews.createdAt,
        likeCount,
        commentCount,
      })
      .from(reviews)
      .where(where)
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(REVIEWS_PAGE_SIZE)
      .offset((page - 1) * REVIEWS_PAGE_SIZE),
    db.$count(reviews, where),
  ]);
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.releaseId!),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const author = { username: access.row.username, displayName: access.row.displayName };
  const items = rows.flatMap((r) => {
    const release = cards.get(r.releaseId!);
    if (!release) return [];
    return {
      id: r.id,
      author,
      release,
      rating: r.rating,
      body: r.body,
      lang: r.lang as AudienceLang,
      createdAt: r.createdAt.toISOString(),
      likeCount: r.likeCount,
      commentCount: r.commentCount,
    };
  });
  return toPage(await blindReviewCards(db, viewer.blind, items), page, REVIEWS_PAGE_SIZE, total);
}

/** Releases the member wants to listen to, most recently queued first. */
export async function getToListenPage(
  db: Db,
  username: string,
  viewer: ProfileViewer,
  page: number,
): Promise<Page<ReleaseCard> | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  if (access.diaryHidden) return emptyPage(page);
  const where = and(
    eq(userItemState.userId, access.userId),
    eq(userItemState.wantToListen, true),
    isNotNull(userItemState.releaseId),
  );
  const [rows, total] = await Promise.all([
    db
      .select({ releaseId: userItemState.releaseId })
      .from(userItemState)
      .where(where)
      .orderBy(desc(userItemState.updatedAt), desc(userItemState.id))
      .limit(TO_LISTEN_PAGE_SIZE)
      .offset((page - 1) * TO_LISTEN_PAGE_SIZE),
    db.$count(userItemState, where),
  ]);
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.releaseId!),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  const items = rows.flatMap((r) => cards.get(r.releaseId!) ?? []);
  return toPage(await maskCards(db, viewer, items), page, TO_LISTEN_PAGE_SIZE, total);
}

/** The member's lists, most recently updated first (paging comes with lists, milestone 8). */
export async function getProfileLists(
  db: Db,
  username: string,
  viewer: ProfileViewer,
): Promise<ListCard[] | null> {
  const access = await findProfile(db, username, viewer);
  if (!access) return null;
  const rows = await db
    .select(listRowColumns)
    .from(lists)
    .innerJoin(profiles, eq(profiles.userId, lists.userId))
    .where(eq(lists.userId, access.userId))
    .orderBy(desc(lists.updatedAt));
  const cards = await loadListCards(db, rows);
  return Promise.all(
    cards.map(async (list) => ({ ...list, preview: await maskCards(db, viewer, list.preview) })),
  );
}

/** Stats on a profile: null for an unknown member or when they made them private. */
export async function getProfileStats(
  db: Db,
  username: string,
  viewer: ProfileViewer,
  now: Date,
): Promise<MemberStats | null> {
  const access = await findProfile(db, username, viewer);
  if (!access || access.statsHidden) return null;
  return getMemberStats(db, access.userId, now);
}
