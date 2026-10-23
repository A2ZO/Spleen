import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  ratedTrackIds,
  recomputeItemState,
  schema,
  setWantToListen,
  sql,
  type Db,
  type DbOrTx,
  type ListenTarget,
} from "@spleen/db";
import {
  todayIn,
  type EntryCreateInput,
  type EntryUpdateInput,
  type ListenTargetInput,
} from "@spleen/validators";

import { fail } from "../../trpc";
import type { MyEntry, MyItemState } from "../../types";
import { requireListener, requireTarget, targetWhere, toTarget } from "./targets";

/*
 * Listening writes. Every write that touches a listen recomputes the member's state for the
 * targets concerned in the same transaction (`recomputeItemState`), so `user_item_state`
 * never drifts from `entries`.
 */

const { entries, entryMoods, moods, releaseTracks, reviews, trackRatings, userItemState } = schema;

async function currentState(db: DbOrTx, userId: string, target: ListenTarget) {
  const [row] = await db
    .select({ rating: userItemState.rating, liked: userItemState.liked })
    .from(userItemState)
    .where(targetWhere(userItemState, userId, target));
  return row ?? { rating: null, liked: false };
}

async function undatedEntry(db: DbOrTx, userId: string, target: ListenTarget) {
  const [row] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(targetWhere(entries, userId, target), isNull(entries.listenedOn)));
  return row ?? null;
}

async function hasEntries(db: DbOrTx, userId: string, target: ListenTarget) {
  return (await db.$count(entries, targetWhere(entries, userId, target))) > 0;
}

/**
 * Deletes the undated listen when nothing is left on it: no rating, no heart, no review
 * and no track rating.
 */
export async function pruneUndated(db: DbOrTx, userId: string, target: ListenTarget) {
  await db
    .delete(entries)
    .where(
      and(
        targetWhere(entries, userId, target),
        isNull(entries.listenedOn),
        isNull(entries.rating),
        eq(entries.liked, false),
        sql`not exists (select 1 from ${reviews} where ${reviews.entryId} = ${entries.id})`,
        sql`not exists (select 1 from ${trackRatings} where ${trackRatings.entryId} = ${entries.id})`,
      ),
    );
}

/**
 * Quick rating or heart from an item page: updates the member's single undated listen
 * (created on demand). The undated listen first mirrors the current state, so changing the
 * rating never flips the heart and vice versa; it then becomes the most recently modified
 * listen, hence the current one.
 */
async function quickUpdate(
  db: Db,
  userId: string,
  input: ListenTargetInput,
  change: { rating: number | null } | { liked: boolean },
): Promise<void> {
  await requireListener(db, userId);
  await db.transaction(async (tx) => {
    const target = await requireTarget(tx, input);
    const state = await currentState(tx, userId, target);
    const next = { rating: state.rating, liked: state.liked, ...change };

    if ("liked" in change && !change.liked) {
      // A heart removed from the item page removes it from every listen of the item, keeping
      // edit times (they decide which rating is current).
      await tx
        .update(entries)
        .set({ liked: false, updatedAt: sql`${entries.updatedAt}` })
        .where(targetWhere(entries, userId, target));
    }

    const undated = await undatedEntry(tx, userId, target);
    if (undated) {
      await tx
        .update(entries)
        .set({ ...next, updatedAt: new Date() })
        .where(eq(entries.id, undated.id));
      await tx.update(reviews).set({ rating: next.rating }).where(eq(reviews.entryId, undated.id));
    } else if (next.rating !== null || next.liked) {
      await tx.insert(entries).values({ userId, ...target, listenedOn: null, ...next });
    }
    await pruneUndated(tx, userId, target);
    await recomputeItemState(tx, userId, target, { clearWantToListen: true });
  });
}

export function quickRate(db: Db, userId: string, input: ListenTargetInput, rating: number | null) {
  return quickUpdate(db, userId, input, { rating });
}

export function quickLike(db: Db, userId: string, input: ListenTargetInput, liked: boolean) {
  return quickUpdate(db, userId, input, { liked });
}

/** "I listened" in one click: a dated listen today (member's time zone), no rating. */
export async function markListened(
  db: Db,
  userId: string,
  input: ListenTargetInput,
  now: Date,
): Promise<{ id: string }> {
  const { timeZone } = await requireListener(db, userId);
  return db.transaction(async (tx) => {
    const target = await requireTarget(tx, input);
    const state = await currentState(tx, userId, target);
    const [row] = await tx
      .insert(entries)
      .values({
        userId,
        ...target,
        listenedOn: todayIn(timeZone, now),
        liked: state.liked,
        isRelisten: await hasEntries(tx, userId, target),
      })
      .returning({ id: entries.id });
    await recomputeItemState(tx, userId, target, { clearWantToListen: true });
    return row!;
  });
}

export async function updateWantToListen(
  db: Db,
  userId: string,
  input: ListenTargetInput,
  wantToListen: boolean,
): Promise<void> {
  await requireListener(db, userId);
  await db.transaction(async (tx) => {
    await setWantToListen(tx, userId, await requireTarget(tx, input), wantToListen);
  });
}

/** Moods must be suggested ones or the member's own. */
async function checkMoods(db: DbOrTx, userId: string, moodIds: string[]) {
  const unique = [...new Set(moodIds)];
  if (unique.length === 0) return unique;
  const found = await db.$count(
    moods,
    and(inArray(moods.id, unique), or(isNull(moods.ownerId), eq(moods.ownerId, userId))),
  );
  if (found !== unique.length) fail("BAD_REQUEST", "MOOD_NOT_FOUND");
  return unique;
}

/** Track ratings belong to album listens and to tracks of that release. */
async function checkTrackRatings(
  db: DbOrTx,
  target: ListenTarget,
  ratings: EntryCreateInput["trackRatings"],
) {
  const byTrack = new Map(ratings.map((r) => [r.trackId, r.rating]));
  if (byTrack.size === 0) return byTrack;
  if (!("releaseId" in target)) fail("BAD_REQUEST", "TRACK_NOT_ON_RELEASE");
  // A track may appear twice on a release (several discs): compare distinct ids.
  const found = await db
    .selectDistinct({ trackId: releaseTracks.trackId })
    .from(releaseTracks)
    .where(
      and(
        eq(releaseTracks.releaseId, target.releaseId),
        inArray(releaseTracks.trackId, [...byTrack.keys()]),
      ),
    );
  if (found.length !== byTrack.size) fail("BAD_REQUEST", "TRACK_NOT_ON_RELEASE");
  return byTrack;
}

function checkDate(listenedOn: string, timeZone: string, now: Date) {
  if (listenedOn > todayIn(timeZone, now)) fail("BAD_REQUEST", "DATE_IN_FUTURE");
}

async function writeDetails(
  tx: DbOrTx,
  entryId: string,
  moodIds: string[],
  byTrack: Map<string, number>,
) {
  await tx.delete(entryMoods).where(eq(entryMoods.entryId, entryId));
  if (moodIds.length > 0) {
    await tx.insert(entryMoods).values(moodIds.map((moodId) => ({ entryId, moodId })));
  }
  await tx.delete(trackRatings).where(eq(trackRatings.entryId, entryId));
  if (byTrack.size > 0) {
    await tx
      .insert(trackRatings)
      .values([...byTrack].map(([trackId, rating]) => ({ entryId, trackId, rating })));
  }
}

async function recomputeAll(
  tx: DbOrTx,
  userId: string,
  target: ListenTarget,
  trackIds: Iterable<string>,
  options: { clearWantToListen?: boolean } = {},
) {
  await recomputeItemState(tx, userId, target, options);
  for (const trackId of new Set(trackIds)) await recomputeItemState(tx, userId, { trackId });
}

/** The "log" form: a dated listen with all its details, and optionally a review. */
export async function createEntry(
  db: Db,
  userId: string,
  input: EntryCreateInput,
  now: Date,
): Promise<{ id: string }> {
  const { timeZone } = await requireListener(db, userId);
  const listenedOn = input.listenedOn ?? todayIn(timeZone, now);
  checkDate(listenedOn, timeZone, now);
  return db.transaction(async (tx) => {
    const target = await requireTarget(tx, input.target);
    const moodIds = await checkMoods(tx, userId, input.moodIds);
    const byTrack = await checkTrackRatings(tx, target, input.trackRatings);
    const [row] = await tx
      .insert(entries)
      .values({
        userId,
        ...target,
        listenedOn,
        rating: input.rating,
        liked: input.liked,
        isRelisten: input.relisten,
        format: input.format,
      })
      .returning({ id: entries.id });
    const id = row!.id;
    await writeDetails(tx, id, moodIds, byTrack);
    if (input.review) {
      await tx.insert(reviews).values({
        userId,
        ...target,
        entryId: id,
        rating: input.rating,
        body: input.review.body,
        lang: input.review.lang,
      });
    }
    await recomputeAll(tx, userId, target, byTrack.keys(), { clearWantToListen: true });
    return { id };
  });
}

async function ownEntry(db: DbOrTx, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)));
  if (!row) fail("NOT_FOUND", "ENTRY_NOT_FOUND");
  const target: ListenTarget = row.releaseId
    ? { releaseId: row.releaseId }
    : { trackId: row.trackId! };
  return { row, target };
}

/** Edits a listen; an undated listen given a date enters the diary (it never loses it). */
export async function updateEntry(
  db: Db,
  userId: string,
  input: EntryUpdateInput,
  now: Date,
): Promise<void> {
  const { timeZone } = await requireListener(db, userId);
  await db.transaction(async (tx) => {
    const { row, target } = await ownEntry(tx, userId, input.id);
    if (input.listenedOn === null && row.listenedOn !== null) fail("BAD_REQUEST", "DATE_REQUIRED");
    if (input.listenedOn !== null) checkDate(input.listenedOn, timeZone, now);
    const moodIds = await checkMoods(tx, userId, input.moodIds);
    const byTrack = await checkTrackRatings(tx, target, input.trackRatings);
    const previousTracks = await ratedTrackIds(tx, [row.id]);

    await tx
      .update(entries)
      .set({
        listenedOn: input.listenedOn,
        rating: input.rating,
        liked: input.liked,
        isRelisten: input.relisten,
        format: input.format,
        updatedAt: new Date(),
      })
      .where(eq(entries.id, row.id));
    await writeDetails(tx, row.id, moodIds, byTrack);
    // Reviews written with this listen show its rating.
    await tx.update(reviews).set({ rating: input.rating }).where(eq(reviews.entryId, row.id));
    await pruneUndated(tx, userId, target);
    await recomputeAll(tx, userId, target, [...previousTracks, ...byTrack.keys()]);
  });
}

/** Deletes a listen; reviews written with it stay (unlinked). */
export async function deleteEntry(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { row, target } = await ownEntry(tx, userId, id);
    const previousTracks = await ratedTrackIds(tx, [row.id]);
    await tx.delete(entries).where(eq(entries.id, row.id));
    await recomputeAll(tx, userId, target, previousTracks);
  });
}

/** The member's state on an item page, with their listens (dated newest first, undated first). */
export async function getMyItemState(
  db: Db,
  userId: string,
  input: ListenTargetInput,
  now: Date,
): Promise<MyItemState> {
  const { timeZone } = await requireListener(db, userId);
  const listenTarget = toTarget(input);

  const [[state], rows] = await Promise.all([
    db
      .select()
      .from(userItemState)
      .where(targetWhere(userItemState, userId, listenTarget)),
    db
      .select()
      .from(entries)
      .where(targetWhere(entries, userId, listenTarget))
      .orderBy(sql`${entries.listenedOn} desc nulls first`, desc(entries.createdAt)),
  ]);
  const ids = rows.map((r) => r.id);
  const [moodRows, ratingRows, reviewRows] =
    ids.length === 0
      ? [[], [], []]
      : await Promise.all([
          db.select().from(entryMoods).where(inArray(entryMoods.entryId, ids)),
          db.select().from(trackRatings).where(inArray(trackRatings.entryId, ids)),
          db
            .select({
              id: reviews.id,
              entryId: reviews.entryId,
              body: reviews.body,
              lang: reviews.lang,
            })
            .from(reviews)
            .where(inArray(reviews.entryId, ids)),
        ]);

  const myEntries: MyEntry[] = rows.map((e) => {
    const review = reviewRows.find((r) => r.entryId === e.id);
    return {
      id: e.id,
      listenedOn: e.listenedOn,
      rating: e.rating,
      liked: e.liked,
      relisten: e.isRelisten,
      format: e.format,
      moodIds: moodRows.filter((m) => m.entryId === e.id).map((m) => m.moodId),
      trackRatings: ratingRows
        .filter((r) => r.entryId === e.id)
        .map(({ trackId, rating }) => ({ trackId, rating })),
      review: review
        ? { id: review.id, body: review.body, lang: review.lang === "en" ? "en" : "fr" }
        : null,
    };
  });
  return {
    rating: state?.rating ?? null,
    liked: state?.liked ?? false,
    listened: state?.listened ?? false,
    wantToListen: state?.wantToListen ?? false,
    entries: myEntries,
    today: todayIn(timeZone, now),
  };
}
