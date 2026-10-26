import { and, desc, inArray, isNull, lt, ne, schema, type Db } from "@spleen/db";

import type { MemberRef, ModerationActionView, Page } from "../../types";

const { comments, lists, moderationActions, notifications, profiles, reports, reviews } = schema;

export const HISTORY_PAGE_SIZE = 30;
/** Reports and decisions are kept one year after the decision, then anonymised. */
export const MODERATION_RETENTION_DAYS = 365;

/** Decisions, latest first, with their author and the member concerned. */
export async function listModerationHistory(
  db: Db,
  page: number,
): Promise<Page<ModerationActionView>> {
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(moderationActions)
      .orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
      .limit(HISTORY_PAGE_SIZE)
      .offset((page - 1) * HISTORY_PAGE_SIZE),
    db.$count(moderationActions),
  ]);
  const userIds = [
    ...new Set(rows.flatMap((r) => [r.moderatorId ?? [], r.targetUserId ?? []]).flat()),
  ];
  const reviewIds = rows.flatMap((r) => r.reviewId ?? []);
  const listIds = rows.flatMap((r) => r.listId ?? []);
  const commentIds = rows.flatMap((r) => r.commentId ?? []);
  const hiddenBy = (table: typeof reviews | typeof lists | typeof comments, ids: string[]) =>
    ids.length
      ? db
          .select({ id: table.id, hiddenBy: table.hiddenBy })
          .from(table)
          .where(inArray(table.id, ids))
      : Promise.resolve([]);
  const [members, hiddenReviews, hiddenLists, hiddenComments] = await Promise.all([
    userIds.length
      ? db
          .select({
            userId: profiles.userId,
            username: profiles.username,
            displayName: profiles.displayName,
          })
          .from(profiles)
          .where(inArray(profiles.userId, userIds))
      : [],
    hiddenBy(reviews, reviewIds),
    hiddenBy(lists, listIds),
    hiddenBy(comments, commentIds),
  ]);
  const refs = new Map<string, MemberRef>(
    members.map((m) => [m.userId, { username: m.username, displayName: m.displayName }]),
  );
  const stillHidden = new Set(
    [...hiddenReviews, ...hiddenLists, ...hiddenComments]
      .filter((row) => row.hiddenBy === "moderation")
      .map((row) => row.id),
  );
  const items = rows.map((r): ModerationActionView => {
    const content = r.reviewId
      ? ({ kind: "review", id: r.reviewId } as const)
      : r.listId
        ? ({ kind: "list", id: r.listId } as const)
        : r.commentId
          ? ({ kind: "comment", id: r.commentId } as const)
          : null;
    return {
      id: r.id,
      action: r.action,
      subject: r.subject,
      reason: r.reason,
      reportReason: r.reportReason,
      moderator: r.moderatorId ? (refs.get(r.moderatorId) ?? null) : null,
      target: r.targetUserId ? (refs.get(r.targetUserId) ?? null) : null,
      excerpt: r.excerpt,
      createdAt: r.createdAt.toISOString(),
      anonymized: r.anonymizedAt !== null,
      restorable: r.action === "hide" && content && stillHidden.has(content.id) ? content : null,
    };
  });
  return {
    items,
    page,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    total,
  };
}

/**
 * Retention: one year after the decision, the history keeps the action, its reason and the
 * report category only. Links to people (moderator, member, content, report), the excerpt and
 * the member's notification go; closed reports (reporter, details) are deleted. Open reports
 * are never touched. Idempotent; run nightly (`pnpm moderation:anonymize`).
 */
export async function anonymizeModerationHistory(
  db: Db,
  now: Date,
): Promise<{ actions: number; reports: number }> {
  const cutoff = new Date(now.getTime() - MODERATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const due = and(
      isNull(moderationActions.anonymizedAt),
      lt(moderationActions.createdAt, cutoff),
    );
    const ids = (
      await tx.select({ id: moderationActions.id }).from(moderationActions).where(due)
    ).map((r) => r.id);
    if (ids.length > 0) {
      await tx.delete(notifications).where(inArray(notifications.moderationActionId, ids));
      await tx
        .update(moderationActions)
        .set({
          moderatorId: null,
          targetUserId: null,
          reviewId: null,
          listId: null,
          commentId: null,
          reportId: null,
          excerpt: "",
          anonymizedAt: now,
        })
        .where(inArray(moderationActions.id, ids));
    }
    const deleted = await tx
      .delete(reports)
      .where(and(ne(reports.status, "open"), lt(reports.resolvedAt, cutoff)))
      .returning({ id: reports.id });
    return { actions: ids.length, reports: deleted.length };
  });
}
