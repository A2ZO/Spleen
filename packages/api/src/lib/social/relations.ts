import {
  and,
  eq,
  inArray,
  or,
  schema,
  sql,
  type AnyColumn,
  type DbOrTx,
  type SQL,
} from "@spleen/db";

import { fail } from "../../trpc";
import type { MemberCard, MemberRef } from "../../types";

/*
 * Who may interact with whom. A block works both ways: neither member can follow, like or
 * comment the other, and each disappears from the other's feed, notifications and comments.
 * The blocked member is never told: their attempts fail with the neutral
 * ACTION_UNAVAILABLE, the same answer as any other "not possible" case.
 */

const { blocks, follows, profiles } = schema;

/**
 * SQL condition: no block either way between `viewerId` and the member in `column`. The
 * subquery aliases `blocks`, and `column` resolves to the outer query (blocks has no
 * column of that name even when drizzle leaves it unqualified).
 */
export function notBlockedWith(viewerId: string, column: AnyColumn | SQL): SQL {
  return sql`not exists (select 1 from "blocks" "b" where ("b"."blocker_id" = ${viewerId} and "b"."blocked_id" = ${column}) or ("b"."blocker_id" = ${column} and "b"."blocked_id" = ${viewerId}))`;
}

export async function isBlockedBetween(db: DbOrTx, a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ one: sql`1` })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Fails like any "not possible" action when a block stands between the two members. */
export async function requireNotBlocked(db: DbOrTx, a: string, b: string): Promise<void> {
  if (await isBlockedBetween(db, a, b)) fail("FORBIDDEN", "ACTION_UNAVAILABLE");
}

export async function requireMember(db: DbOrTx, username: string) {
  const [row] = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${username.toLowerCase()}`)
    .limit(1);
  if (!row) fail("NOT_FOUND", "MEMBER_NOT_FOUND");
  return row;
}

/** Display names and avatars of members, by user id. */
export async function memberRefs(db: DbOrTx, userIds: string[]): Promise<Map<string, MemberRef>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(inArray(profiles.userId, unique));
  return new Map(rows.map(({ userId, ...ref }) => [userId, ref]));
}

/** Member cards in the order of `userIds`, with whether the viewer follows each one. */
export async function memberCards(
  db: DbOrTx,
  userIds: string[],
  viewerId: string | null,
): Promise<MemberCard[]> {
  if (userIds.length === 0) return [];
  const [rows, followed] = await Promise.all([
    db
      .select({
        userId: profiles.userId,
        username: profiles.username,
        displayName: profiles.displayName,
        bio: profiles.bio,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(inArray(profiles.userId, userIds)),
    viewerId
      ? db
          .select({ id: follows.followeeId })
          .from(follows)
          .where(and(eq(follows.followerId, viewerId), inArray(follows.followeeId, userIds)))
      : [],
  ]);
  const byId = new Map(rows.map((r) => [r.userId, r]));
  const followedIds = new Set(followed.map((f) => f.id));
  return userIds.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    const { userId, ...card } = row;
    return { ...card, viewerFollows: followedIds.has(userId), isViewer: userId === viewerId };
  });
}
