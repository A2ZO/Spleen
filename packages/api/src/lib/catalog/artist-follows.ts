import { and, asc, eq, schema, sql, type Db } from "@spleen/db";
import { ARTIST_FOLLOWS_MAX } from "@spleen/validators";

import { fail } from "../../trpc";
import type { FollowedArtist } from "../../types";

const { artistFollows, artists, profiles } = schema;

/** Following needs a profile (onboarding done). */
async function requireProfile(db: Db, userId: string) {
  const [row] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  if (!row) fail("PRECONDITION_FAILED", "PROFILE_REQUIRED");
}

/** The artist page to follow: a merged duplicate stands for the page it was merged into. */
async function resolveArtist(db: Db, artistId: string): Promise<string> {
  const [row] = await db
    .select({ id: artists.id, mergedIntoId: artists.mergedIntoId })
    .from(artists)
    .where(eq(artists.id, artistId));
  if (!row) fail("NOT_FOUND", "ITEM_NOT_FOUND");
  return row.mergedIntoId ?? row.id;
}

/** Follows an artist. Following twice changes nothing; at most `ARTIST_FOLLOWS_MAX`. */
export async function followArtist(
  db: Db,
  userId: string,
  artistId: string,
  now: Date,
): Promise<{ following: true }> {
  await requireProfile(db, userId);
  const id = await resolveArtist(db, artistId);
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ artistId: artistFollows.artistId })
      .from(artistFollows)
      .where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, id)));
    if (existing) return;
    if ((await tx.$count(artistFollows, eq(artistFollows.userId, userId))) >= ARTIST_FOLLOWS_MAX) {
      fail("BAD_REQUEST", "ARTIST_FOLLOW_LIMIT");
    }
    await tx
      .insert(artistFollows)
      .values({ userId, artistId: id, createdAt: now })
      .onConflictDoNothing();
  });
  return { following: true };
}

/** Stops following an artist (nothing happens when the member did not follow it). */
export async function unfollowArtist(
  db: Db,
  userId: string,
  artistId: string,
): Promise<{ following: false }> {
  await requireProfile(db, userId);
  const id = await resolveArtist(db, artistId);
  await db
    .delete(artistFollows)
    .where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, id)));
  return { following: false };
}

/** Whether the member follows this artist (its merged page counts as the page kept). */
export async function artistFollowStatus(
  db: Db,
  userId: string,
  slug: string,
): Promise<{ following: boolean }> {
  // One query, read in parallel with the artist page: a merged duplicate's slug stands for
  // the page it was merged into.
  const [row] = await db
    .select({ artistId: artistFollows.artistId })
    .from(artists)
    .innerJoin(
      artistFollows,
      and(
        eq(artistFollows.userId, userId),
        eq(artistFollows.artistId, sql`coalesce(${artists.mergedIntoId}, ${artists.id})`),
      ),
    )
    .where(eq(artists.slug, slug));
  return { following: Boolean(row) };
}

/** The member's own followed artists, by name (private list, settings page). */
export async function myFollowedArtists(db: Db, userId: string): Promise<FollowedArtist[]> {
  await requireProfile(db, userId);
  const rows = await db
    .select({
      id: artists.id,
      slug: artists.slug,
      name: artists.name,
      imageUrl: artists.imageUrl,
      followedAt: artistFollows.createdAt,
    })
    .from(artistFollows)
    .innerJoin(artists, eq(artists.id, artistFollows.artistId))
    .where(eq(artistFollows.userId, userId))
    .orderBy(asc(artists.name), asc(artists.id))
    .limit(ARTIST_FOLLOWS_MAX);
  return rows.map((r) => ({ ...r, followedAt: r.followedAt.toISOString() }));
}

/** Turns the release-day notifications on or off. */
export async function setNotifyReleases(db: Db, userId: string, enabled: boolean): Promise<void> {
  const updated = await db
    .update(profiles)
    .set({ notifyReleases: enabled })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  if (updated.length === 0) fail("PRECONDITION_FAILED", "PROFILE_REQUIRED");
}
