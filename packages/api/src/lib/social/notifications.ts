import { and, eq, inArray, isNull, or, schema, sql, type Db, type DbOrTx } from "@spleen/db";

import type { CursorPage, NotificationGroup } from "../../types";
import { cursorTime, decodeCursor, encodeCursor, pageOf } from "./cursor";
import { isBlockedBetween, memberRefs, notBlockedWith } from "./relations";

/*
 * In-site notifications: a new follower, a like or a comment on the member's review (or
 * list). One row per event; rows sharing a `group_key` show as one group: likes and comments
 * per review / list, new followers per day (in the recipient's time zone). Undoing the action (unfollow, unlike, deleted comment)
 * removes its row. Nothing is ever created across a block, and a block erases what exists.
 */

const { comments, lists, notifications, profiles, releases, reviews, tracks } = schema;

export const NOTIFICATIONS_PAGE_SIZE = 20;
const ACTORS_SHOWN = 3;
const EXCERPT_LENGTH = 140;

export interface NotificationEvent {
  /** Recipient. */
  userId: string;
  actorId: string;
  type: "follow" | "like" | "comment";
  reviewId?: string;
  listId?: string;
  commentId?: string;
}

/** The recipient's calendar day at `now`, in their time zone ("2026-10-24"). */
async function localDay(db: DbOrTx, userId: string, now: Date): Promise<string> {
  const [row] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: row?.timeZone ?? "UTC" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Records an event for its recipient (never to oneself, never across a block). */
export async function notify(db: DbOrTx, event: NotificationEvent, now: Date): Promise<void> {
  if (event.userId === event.actorId) return;
  if (await isBlockedBetween(db, event.userId, event.actorId)) return;
  const subject = event.reviewId
    ? `review:${event.reviewId}`
    : event.listId
      ? `list:${event.listId}`
      : `day:${await localDay(db, event.userId, now)}`;
  await db
    .insert(notifications)
    .values({
      userId: event.userId,
      actorId: event.actorId,
      type: event.type,
      reviewId: event.reviewId ?? null,
      listId: event.listId ?? null,
      commentId: event.commentId ?? null,
      groupKey: `${event.type}:${subject}`,
      createdAt: now,
    })
    .onConflictDoNothing();
}

/** Removes the notification of an undone follow or like. */
export async function unnotify(
  db: DbOrTx,
  event: Omit<NotificationEvent, "commentId">,
): Promise<void> {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, event.userId),
        eq(notifications.actorId, event.actorId),
        eq(notifications.type, event.type),
        event.reviewId ? eq(notifications.reviewId, event.reviewId) : undefined,
        event.listId ? eq(notifications.listId, event.listId) : undefined,
      ),
    );
}

/** Erases the notifications two members sent each other (on a block). */
export async function eraseNotificationsBetween(db: DbOrTx, a: string, b: string): Promise<void> {
  await db
    .delete(notifications)
    .where(
      or(
        and(eq(notifications.userId, a), eq(notifications.actorId, b)),
        and(eq(notifications.userId, b), eq(notifications.actorId, a)),
      ),
    );
}

const visible = (userId: string) =>
  and(
    eq(notifications.userId, userId),
    sql`(${notifications.actorId} is null or ${notBlockedWith(userId, notifications.actorId)})`,
  );

/** Number of unread groups (the header badge). */
export async function unreadCount(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${notifications.groupKey})::int` })
    .from(notifications)
    .where(and(visible(userId), isNull(notifications.readAt)));
  return row?.count ?? 0;
}

export async function markAllRead(db: Db, userId: string, now: Date): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/** Notification groups, most recent first. */
export async function listNotifications(
  db: Db,
  userId: string,
  cursor: string | undefined,
): Promise<CursorPage<NotificationGroup>> {
  const after = cursor ? decodeCursor(cursor, 2) : null;
  const latest = sql<Date>`max(${notifications.createdAt})`;
  const rows = await db
    .select({
      key: notifications.groupKey,
      type: sql<NotificationGroup["type"]>`min(${notifications.type}::text)`,
      latestAt: latest,
      latestText: sql<string>`max(${notifications.createdAt})::text`,
      unread: sql<boolean>`bool_or(${notifications.readAt} is null)`,
      actorIds: sql<
        string[]
      >`(array_agg(${notifications.actorId} order by ${notifications.createdAt} desc) filter (where ${notifications.actorId} is not null))`,
      actorCount: sql<number>`count(distinct ${notifications.actorId})::int`,
      reviewId: sql<string | null>`min(${notifications.reviewId}::text)`,
      listId: sql<string | null>`min(${notifications.listId}::text)`,
      commentId: sql<
        string | null
      >`(array_agg(${notifications.commentId}::text order by ${notifications.createdAt} desc))[1]`,
    })
    .from(notifications)
    .where(visible(userId))
    .groupBy(notifications.groupKey)
    .having(
      after
        ? sql`(max(${notifications.createdAt}), ${notifications.groupKey}) < (${cursorTime(after[0]!)}::timestamptz, ${after[1]!})`
        : undefined,
    )
    .orderBy(sql`max(${notifications.createdAt}) desc`, sql`${notifications.groupKey} desc`)
    .limit(NOTIFICATIONS_PAGE_SIZE + 1);
  const page = pageOf(rows, NOTIFICATIONS_PAGE_SIZE, (last) =>
    encodeCursor([last.latestText, last.key]),
  );

  const actorIds = page.items.flatMap((r) => [...new Set(r.actorIds ?? [])].slice(0, ACTORS_SHOWN));
  const reviewIds = page.items.flatMap((r) => r.reviewId ?? []);
  const listIds = page.items.flatMap((r) => r.listId ?? []);
  const commentIds = page.items.flatMap((r) => r.commentId ?? []);
  const releaseTitle = sql<string>`coalesce(${releases.title}, ${tracks.title}, '')`;
  const [actors, reviewRows, listRows, commentRows] = await Promise.all([
    memberRefs(db, actorIds),
    reviewIds.length
      ? db
          .select({ id: reviews.id, title: releaseTitle })
          .from(reviews)
          .leftJoin(releases, eq(releases.id, reviews.releaseId))
          .leftJoin(tracks, eq(tracks.id, reviews.trackId))
          .where(inArray(reviews.id, reviewIds))
      : [],
    listIds.length
      ? db
          .select({ id: lists.id, title: lists.title })
          .from(lists)
          .where(inArray(lists.id, listIds))
      : [],
    commentIds.length
      ? db
          .select({ id: comments.id, body: comments.body })
          .from(comments)
          .where(inArray(comments.id, commentIds))
      : [],
  ]);
  const reviewTitles = new Map(reviewRows.map((r) => [r.id, r.title]));
  const listTitles = new Map(listRows.map((l) => [l.id, l.title]));
  const bodies = new Map(commentRows.map((c) => [c.id, c.body]));

  return {
    nextCursor: page.nextCursor,
    items: page.items.map((r) => {
      const body = r.commentId ? bodies.get(r.commentId) : undefined;
      return {
        key: r.key,
        type: r.type,
        latestAt: new Date(r.latestAt).toISOString(),
        unread: r.unread,
        actors: [...new Set(r.actorIds ?? [])]
          .slice(0, ACTORS_SHOWN)
          .flatMap((id) => actors.get(id) ?? []),
        actorCount: r.actorCount,
        review: r.reviewId
          ? { id: r.reviewId, releaseTitle: reviewTitles.get(r.reviewId) ?? "" }
          : null,
        list: r.listId ? { id: r.listId, title: listTitles.get(r.listId) ?? "" } : null,
        commentExcerpt:
          body === undefined
            ? null
            : body.length > EXCERPT_LENGTH
              ? `${body.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`
              : body,
      };
    }),
  };
}
