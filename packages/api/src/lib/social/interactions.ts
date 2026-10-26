import { and, asc, eq, schema, sql, type Db } from "@spleen/db";
import type { ReportCreateInput, SocialSubjectInput } from "@spleen/validators";

import { fail } from "../../trpc";
import type { CommentView, CursorPage } from "../../types";
import { requireListener } from "../listening/targets";
import { cursorTime, cursorUuid, decodeCursor, encodeCursor, pageOf } from "./cursor";
import { notify, unnotify } from "./notifications";
import { memberRefs, notBlockedWith, requireMember, requireNotBlocked } from "./relations";
import { liveCommentsOf, resolveSubject, type ResolvedSubject } from "./reviews";

/*
 * Likes, comments and reports on reviews (and lists, whose pages come in milestone 8).
 * Comments are soft-deleted: by their author, or by the owner of the review / list.
 */

const { comments, likes, reports, reviews } = schema;

export const COMMENTS_PAGE_SIZE = 50;

const subjectEvent = (subject: ResolvedSubject) =>
  "reviewId" in subject.column
    ? { reviewId: subject.column.reviewId }
    : { listId: subject.column.listId };

/** Likes or unlikes a review or a list; returns the new state and count. */
export async function setLike(
  db: Db,
  userId: string,
  input: SocialSubjectInput,
  liked: boolean,
  now: Date,
): Promise<{ liked: boolean; likeCount: number }> {
  await requireListener(db, userId);
  const subject = await resolveSubject(db, input);
  if (subject.ownerId === userId) fail("BAD_REQUEST", "SELF_ACTION");
  await requireNotBlocked(db, userId, subject.ownerId);
  const event = { userId: subject.ownerId, actorId: userId, type: "like" as const };
  const where =
    "reviewId" in subject.column
      ? eq(likes.reviewId, subject.column.reviewId)
      : eq(likes.listId, subject.column.listId);
  await db.transaction(async (tx) => {
    if (liked) {
      const inserted = await tx
        .insert(likes)
        .values({ userId, ...subject.column, createdAt: now })
        .onConflictDoNothing()
        .returning({ id: likes.id });
      if (inserted.length > 0) await notify(tx, { ...event, ...subjectEvent(subject) }, now);
    } else {
      await tx.delete(likes).where(and(eq(likes.userId, userId), where));
      await unnotify(tx, { ...event, ...subjectEvent(subject) });
    }
  });
  return { liked, likeCount: await db.$count(likes, where) };
}

async function toCommentViews(
  db: Db,
  rows: (typeof comments.$inferSelect)[],
  ownerId: string,
  viewerId: string | null,
): Promise<CommentView[]> {
  const authors = await memberRefs(
    db,
    rows.map((r) => r.userId),
  );
  return rows.flatMap((r) => {
    const author = authors.get(r.userId);
    if (!author) return [];
    return {
      id: r.id,
      author,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      edited: r.editedAt !== null,
      canEdit: r.userId === viewerId,
      canDelete: viewerId !== null && (r.userId === viewerId || ownerId === viewerId),
    };
  });
}

/**
 * Comments, oldest first; those of members blocked with the viewer are left out, except for
 * the subject's owner, who must still see (and may delete) them.
 */
export async function listComments(
  db: Db,
  input: SocialSubjectInput,
  viewerId: string | null,
  cursor: string | undefined,
): Promise<CursorPage<CommentView>> {
  const subject = await resolveSubject(db, input);
  const after = cursor ? decodeCursor(cursor, 2) : null;
  const rows = await db
    .select({ comment: comments, at: sql<string>`${comments.createdAt}::text` })
    .from(comments)
    .where(
      and(
        liveCommentsOf(subject.column),
        viewerId && viewerId !== subject.ownerId
          ? notBlockedWith(viewerId, comments.userId)
          : undefined,
        after
          ? sql`(${comments.createdAt}, ${comments.id}) > (${cursorTime(after[0]!)}::timestamptz, ${cursorUuid(after[1]!)})`
          : undefined,
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(COMMENTS_PAGE_SIZE + 1);
  const page = pageOf(rows, COMMENTS_PAGE_SIZE, (last) => encodeCursor([last.at, last.comment.id]));
  return {
    items: await toCommentViews(
      db,
      page.items.map((r) => r.comment),
      subject.ownerId,
      viewerId,
    ),
    nextCursor: page.nextCursor,
  };
}

export async function createComment(
  db: Db,
  userId: string,
  input: SocialSubjectInput,
  body: string,
  now: Date,
): Promise<CommentView> {
  await requireListener(db, userId);
  const subject = await resolveSubject(db, input);
  await requireNotBlocked(db, userId, subject.ownerId);
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(comments)
      .values({ userId, ...subject.column, body, createdAt: now, updatedAt: now })
      .returning();
    await notify(
      tx,
      {
        userId: subject.ownerId,
        actorId: userId,
        type: "comment",
        commentId: inserted!.id,
        ...subjectEvent(subject),
      },
      now,
    );
    return inserted!;
  });
  const [view] = await toCommentViews(db, [row], subject.ownerId, userId);
  return view!;
}

/** A comment that is not deleted, with the owner of what it is on. */
async function findComment(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), sql`${comments.deletedAt} is null`));
  if (!row) fail("NOT_FOUND", "COMMENT_NOT_FOUND");
  const subject = await resolveSubject(
    db,
    row.reviewId ? { kind: "review", id: row.reviewId } : { kind: "list", id: row.listId! },
  );
  return { row, ownerId: subject.ownerId };
}

/** Only the author edits a comment. */
export async function updateComment(
  db: Db,
  userId: string,
  id: string,
  body: string,
  now: Date,
): Promise<CommentView> {
  const { row, ownerId } = await findComment(db, id);
  if (row.userId !== userId) fail("NOT_FOUND", "COMMENT_NOT_FOUND");
  const [updated] = await db
    .update(comments)
    .set({ body, editedAt: now })
    .where(eq(comments.id, id))
    .returning();
  const [view] = await toCommentViews(db, [updated!], ownerId, userId);
  return view!;
}

/** The author, or the owner of the review / list, deletes a comment. */
export async function deleteComment(db: Db, userId: string, id: string, now: Date): Promise<void> {
  const { row, ownerId } = await findComment(db, id);
  if (row.userId !== userId && ownerId !== userId) fail("NOT_FOUND", "COMMENT_NOT_FOUND");
  await db.transaction(async (tx) => {
    await tx.update(comments).set({ deletedAt: now }).where(eq(comments.id, id));
    await tx.delete(schema.notifications).where(eq(schema.notifications.commentId, id));
  });
}

/**
 * Records a report for moderation (queue in milestone 9). Reporting oneself or one's own
 * content is refused; the same open report twice adds nothing.
 */
export async function createReport(
  db: Db,
  userId: string,
  input: ReportCreateInput,
  now: Date,
): Promise<void> {
  await requireListener(db, userId);
  let subject: { reportedUserId: string } | { reviewId: string } | { commentId: string };
  let ownerId: string;
  switch (input.subject.kind) {
    case "member": {
      const member = await requireMember(db, input.subject.username);
      subject = { reportedUserId: member.userId };
      ownerId = member.userId;
      break;
    }
    case "review": {
      const [row] = await db
        .select({ ownerId: reviews.userId })
        .from(reviews)
        .where(eq(reviews.id, input.subject.id));
      if (!row) fail("NOT_FOUND", "REVIEW_NOT_FOUND");
      subject = { reviewId: input.subject.id };
      ownerId = row.ownerId;
      break;
    }
    case "comment": {
      const { row } = await findComment(db, input.subject.id);
      subject = { commentId: row.id };
      ownerId = row.userId;
      break;
    }
  }
  if (ownerId === userId) fail("BAD_REQUEST", "SELF_ACTION");
  await db
    .insert(reports)
    .values({
      reporterId: userId,
      ...subject,
      reason: input.reason,
      details: input.details,
      createdAt: now,
    })
    .onConflictDoNothing();
}
