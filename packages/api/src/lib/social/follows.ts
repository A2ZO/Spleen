import { and, desc, eq, schema, sql, type Db } from "@spleen/db";

import { fail } from "../../trpc";
import type { BlockedMember, CursorPage, MemberCard } from "../../types";
import { requireListener } from "../listening/targets";
import { cursorTime, cursorUuid, decodeCursor, encodeCursor, pageOf } from "./cursor";
import { eraseNotificationsBetween, notify, unnotify } from "./notifications";
import { memberCards, notBlockedWith, requireMember, requireNotBlocked } from "./relations";

/* Following, and blocking (which ends following both ways). */

const { blocks, follows, profiles } = schema;

export const FOLLOWS_PAGE_SIZE = 30;

/** Follows a member (again: nothing changes). */
export async function follow(db: Db, userId: string, username: string, now: Date): Promise<void> {
  await requireListener(db, userId);
  const target = await requireMember(db, username);
  if (target.userId === userId) fail("BAD_REQUEST", "SELF_ACTION");
  await requireNotBlocked(db, userId, target.userId);
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(follows)
      .values({ followerId: userId, followeeId: target.userId, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: follows.followeeId });
    if (inserted.length > 0) {
      await notify(tx, { userId: target.userId, actorId: userId, type: "follow" }, now);
    }
  });
}

export async function unfollow(db: Db, userId: string, username: string): Promise<void> {
  const target = await requireMember(db, username);
  await db.transaction(async (tx) => {
    await tx
      .delete(follows)
      .where(and(eq(follows.followerId, userId), eq(follows.followeeId, target.userId)));
    await unnotify(tx, { userId: target.userId, actorId: userId, type: "follow" });
  });
}

/**
 * Followers (`direction: "followers"`) or followed members of `username`, newest first.
 * Members blocked with the viewer (either way) are left out.
 */
export async function followPage(
  db: Db,
  username: string,
  direction: "followers" | "following",
  viewerId: string | null,
  cursor: string | undefined,
): Promise<CursorPage<MemberCard> | null> {
  const [owner] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${username.toLowerCase()}`);
  if (!owner) return null;
  const [mine, other] =
    direction === "followers"
      ? [follows.followeeId, follows.followerId]
      : [follows.followerId, follows.followeeId];
  const after = cursor ? decodeCursor(cursor, 2) : null;
  const rows = await db
    .select({ memberId: other, at: sql<string>`${follows.createdAt}::text` })
    .from(follows)
    .innerJoin(profiles, eq(profiles.userId, other))
    .where(
      and(
        eq(mine, owner.userId),
        viewerId ? notBlockedWith(viewerId, other) : undefined,
        after
          ? sql`(${follows.createdAt}, ${other}) < (${cursorTime(after[0]!)}::timestamptz, ${cursorUuid(after[1]!)})`
          : undefined,
      ),
    )
    .orderBy(desc(follows.createdAt), desc(other))
    .limit(FOLLOWS_PAGE_SIZE + 1);
  const page = pageOf(rows, FOLLOWS_PAGE_SIZE, (last) => encodeCursor([last.at, last.memberId]));
  return {
    items: await memberCards(
      db,
      page.items.map((r) => r.memberId),
      viewerId,
    ),
    nextCursor: page.nextCursor,
  };
}

/**
 * Blocks a member: both stop following each other and their notifications to each other
 * are erased. The blocked member is not told.
 */
export async function block(db: Db, userId: string, username: string, now: Date): Promise<void> {
  await requireListener(db, userId);
  const target = await requireMember(db, username);
  if (target.userId === userId) fail("BAD_REQUEST", "SELF_ACTION");
  await db.transaction(async (tx) => {
    await tx
      .insert(blocks)
      .values({ blockerId: userId, blockedId: target.userId, createdAt: now })
      .onConflictDoNothing();
    await tx
      .delete(follows)
      .where(
        sql`(${follows.followerId} = ${userId} and ${follows.followeeId} = ${target.userId}) or (${follows.followerId} = ${target.userId} and ${follows.followeeId} = ${userId})`,
      );
    await eraseNotificationsBetween(tx, userId, target.userId);
  });
}

export async function unblock(db: Db, userId: string, username: string): Promise<void> {
  const target = await requireMember(db, username);
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, target.userId)));
}

/** The members the caller blocked, most recent first. */
export async function listBlocks(db: Db, userId: string): Promise<BlockedMember[]> {
  const rows = await db
    .select({
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      blockedAt: blocks.createdAt,
    })
    .from(blocks)
    .innerJoin(profiles, eq(profiles.userId, blocks.blockedId))
    .where(eq(blocks.blockerId, userId))
    .orderBy(desc(blocks.createdAt));
  return rows.map((r) => ({ ...r, blockedAt: r.blockedAt.toISOString() }));
}
