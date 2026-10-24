import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { entries, trackRatings, userItemState, userListeningVersion } from "./schema";

/** What a member listens to: an album/EP/single or a track (artists are not "listened"). */
export type ListenTarget = { releaseId: string } | { trackId: string };

/** A database or an open transaction (both expose the same query builder). */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

interface Opinion {
  rating: number | null;
  liked: boolean;
  updatedAt: Date;
}

/** Listens of a member for one target, with the track ratings given inside album listens. */
async function opinionsFor(db: DbOrTx, userId: string, target: ListenTarget): Promise<Opinion[]> {
  if ("releaseId" in target) {
    return db
      .select({ rating: entries.rating, liked: entries.liked, updatedAt: entries.updatedAt })
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.releaseId, target.releaseId)));
  }
  const [own, fromAlbums] = await Promise.all([
    db
      .select({ rating: entries.rating, liked: entries.liked, updatedAt: entries.updatedAt })
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.trackId, target.trackId))),
    db
      .select({ rating: trackRatings.rating, updatedAt: entries.updatedAt })
      .from(trackRatings)
      .innerJoin(entries, eq(entries.id, trackRatings.entryId))
      .where(and(eq(entries.userId, userId), eq(trackRatings.trackId, target.trackId))),
  ]);
  // A track rated inside an album listen counts as listened, never as liked.
  return [...own, ...fromAlbums.map((r) => ({ ...r, liked: false }))];
}

const newestFirst = (a: Opinion, b: Opinion) => b.updatedAt.getTime() - a.updatedAt.getTime();

/**
 * Derives the current state of a member for a target from their listens, so that
 * `user_item_state` never drifts from `entries`. Call it in the same transaction as every
 * write that touches a listen (or a track rating), for each target concerned:
 * - listened: at least one listen;
 * - rating: rating of the most recently *modified* listen that has one (not the latest
 *   listening date: re-rating an old listen must change the current rating);
 * - liked: heart of the most recently modified listen; likedAt is kept while the heart stays,
 *   and set to that listen's edit time when the heart is (given again);
 * - wantToListen is kept, or cleared with `clearWantToListen` (a new listen);
 * - no listen and not "to listen" → the state row is deleted.
 * Also bumps the member's stats version (`bumpStatsVersion`), which outdates their cache.
 */
export async function recomputeItemState(
  db: DbOrTx,
  userId: string,
  target: ListenTarget,
  options: { clearWantToListen?: boolean } = {},
): Promise<void> {
  const column = "releaseId" in target ? userItemState.releaseId : userItemState.trackId;
  const targetId = "releaseId" in target ? target.releaseId : target.trackId;
  const where = and(eq(userItemState.userId, userId), eq(column, targetId));

  const [opinions, [current]] = await Promise.all([
    opinionsFor(db, userId, target),
    db
      .select({
        wantToListen: userItemState.wantToListen,
        liked: userItemState.liked,
        likedAt: userItemState.likedAt,
      })
      .from(userItemState)
      .where(where),
  ]);
  await bumpStatsVersion(db, userId);

  const sorted = [...opinions].sort(newestFirst);
  const wantToListen = options.clearWantToListen ? false : (current?.wantToListen ?? false);
  if (sorted.length === 0 && !wantToListen) {
    await db.delete(userItemState).where(where);
    return;
  }
  const liked = sorted[0]?.liked ?? false;
  const likedAt = !liked
    ? null
    : current?.liked && current.likedAt
      ? current.likedAt
      : sorted[0]!.updatedAt;
  const values = {
    rating: sorted.find((o) => o.rating !== null)?.rating ?? null,
    liked,
    likedAt,
    listened: sorted.length > 0,
    wantToListen,
  };
  await db
    .insert(userItemState)
    .values({ userId, ...target, ...values })
    .onConflictDoUpdate({
      target: [userItemState.userId, column],
      targetWhere: isNotNull(column),
      set: values,
    });
}

/**
 * Bumps the member's stats version and returns their last quick rating order. Call it inside
 * the write's transaction: the row stays locked until it commits, so it also serialises the
 * member's listening writes.
 */
export async function bumpStatsVersion(db: DbOrTx, userId: string) {
  const [row] = await db
    .insert(userListeningVersion)
    .values({ userId, statsVersion: 1 })
    .onConflictDoUpdate({
      target: userListeningVersion.userId,
      set: { statsVersion: sql`${userListeningVersion.statsVersion} + 1` },
    })
    .returning({
      statsVersion: userListeningVersion.statsVersion,
      quickClientId: userListeningVersion.quickClientId,
      quickSeq: userListeningVersion.quickSeq,
    });
  return row!;
}

/** Sets or clears "to listen" for a target, keeping the rest of the state derived. */
export async function setWantToListen(
  db: DbOrTx,
  userId: string,
  target: ListenTarget,
  wantToListen: boolean,
): Promise<void> {
  const column = "releaseId" in target ? userItemState.releaseId : userItemState.trackId;
  await db
    .insert(userItemState)
    .values({ userId, ...target, wantToListen })
    .onConflictDoUpdate({
      target: [userItemState.userId, column],
      targetWhere: isNotNull(column),
      set: { wantToListen },
    });
  if (!wantToListen) await recomputeItemState(db, userId, target);
}

/** Every target a member has listened to or queued, e.g. to rebuild all their states. */
export async function listenedTargets(db: DbOrTx, userId: string): Promise<ListenTarget[]> {
  const rows = await db
    .selectDistinct({ releaseId: entries.releaseId, trackId: entries.trackId })
    .from(entries)
    .where(eq(entries.userId, userId));
  const rated = await db
    .selectDistinct({ trackId: trackRatings.trackId })
    .from(trackRatings)
    .innerJoin(entries, eq(entries.id, trackRatings.entryId))
    .where(eq(entries.userId, userId));
  const targets = new Map<string, ListenTarget>();
  for (const r of rows) {
    if (r.releaseId) targets.set(`r:${r.releaseId}`, { releaseId: r.releaseId });
    if (r.trackId) targets.set(`t:${r.trackId}`, { trackId: r.trackId });
  }
  for (const r of rated) targets.set(`t:${r.trackId}`, { trackId: r.trackId });
  return [...targets.values()];
}

/** Tracks that have a rating inside the given album listens (to recompute after edits). */
export async function ratedTrackIds(db: DbOrTx, entryIds: string[]): Promise<string[]> {
  if (entryIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ trackId: trackRatings.trackId })
    .from(trackRatings)
    .where(inArray(trackRatings.entryId, entryIds));
  return rows.map((r) => r.trackId);
}
