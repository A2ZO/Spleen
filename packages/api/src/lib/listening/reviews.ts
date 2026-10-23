import { and, eq, recomputeItemState, schema, type Db } from "@spleen/db";
import type { AudienceLang, ListenTargetInput } from "@spleen/validators";

import { fail } from "../../trpc";
import type { MyReview } from "../../types";
import { loadReleaseCards, loadTrackCards, toReleaseCard } from "../catalog/cards";
import { pruneUndated } from "./entries";
import { requireListener, requireTarget, targetWhere } from "./targets";

/*
 * Reviews are independent from ratings: a review may have no rating (the snapshot is the
 * linked listen's rating, else the member's current rating, else none).
 */

const { entries, reviews, userItemState } = schema;

export async function createReview(
  db: Db,
  userId: string,
  input: { target: ListenTargetInput; body: string; lang: AudienceLang; entryId?: string | null },
): Promise<{ id: string }> {
  await requireListener(db, userId);
  return db.transaction(async (tx) => {
    const target = await requireTarget(tx, input.target);
    let rating: number | null = null;
    if (input.entryId) {
      const [entry] = await tx
        .select({ rating: entries.rating })
        .from(entries)
        .where(and(eq(entries.id, input.entryId), targetWhere(entries, userId, target)));
      if (!entry) fail("NOT_FOUND", "ENTRY_NOT_FOUND");
      rating = entry.rating;
    } else {
      const [state] = await tx
        .select({ rating: userItemState.rating })
        .from(userItemState)
        .where(targetWhere(userItemState, userId, target));
      rating = state?.rating ?? null;
    }
    const [row] = await tx
      .insert(reviews)
      .values({
        userId,
        ...target,
        entryId: input.entryId ?? null,
        rating,
        body: input.body,
        lang: input.lang,
      })
      .returning({ id: reviews.id });
    return row!;
  });
}

export async function updateReview(
  db: Db,
  userId: string,
  input: { id: string; body: string; lang: AudienceLang },
): Promise<void> {
  const updated = await db
    .update(reviews)
    .set({ body: input.body, lang: input.lang })
    .where(and(eq(reviews.id, input.id), eq(reviews.userId, userId)))
    .returning({ id: reviews.id });
  if (updated.length === 0) fail("NOT_FOUND", "REVIEW_NOT_FOUND");
}

/** Deleting a review may leave an empty undated listen behind: it is removed too. */
export async function deleteReview(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(reviews)
      .where(and(eq(reviews.id, id), eq(reviews.userId, userId)))
      .returning({ entryId: reviews.entryId });
    if (!row) fail("NOT_FOUND", "REVIEW_NOT_FOUND");
    if (!row.entryId) return;
    const [entry] = await tx
      .select({ releaseId: entries.releaseId, trackId: entries.trackId })
      .from(entries)
      .where(eq(entries.id, row.entryId));
    if (!entry) return;
    const target = entry.releaseId ? { releaseId: entry.releaseId } : { trackId: entry.trackId! };
    await pruneUndated(tx, userId, target);
    await recomputeItemState(tx, userId, target);
  });
}

/** One of the member's own reviews, for the edit screen (null if missing or someone else's). */
export async function getMyReview(db: Db, userId: string, id: string): Promise<MyReview | null> {
  const [row] = await db
    .select({
      id: reviews.id,
      releaseId: reviews.releaseId,
      trackId: reviews.trackId,
      rating: reviews.rating,
      body: reviews.body,
      lang: reviews.lang,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.userId, userId)));
  if (!row) return null;
  const releaseId = row.releaseId ?? (await loadTrackCards(db, [row.trackId!]))[0]?.release?.id;
  const [card] = releaseId ? await loadReleaseCards(db, [releaseId]) : [];
  if (!card) return null;
  return {
    id: row.id,
    release: toReleaseCard(card),
    rating: row.rating,
    body: row.body,
    lang: row.lang as AudienceLang,
    createdAt: row.createdAt.toISOString(),
  };
}
