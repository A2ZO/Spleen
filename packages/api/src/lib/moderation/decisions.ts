import { and, eq, isNull, schema, sql, type Db, type DbOrTx } from "@spleen/db";
import type { Locale } from "@spleen/i18n";
import type { Mailer } from "@spleen/infra/email";
import type {
  MemberModerationInput,
  ReportDecisionInput,
  RestoreContentInput,
} from "@spleen/validators";

import { fail, type Account } from "../../trpc";
import type { ModerationActionKind, ModerationSubject, MySuspension } from "../../types";
import { deleteReview } from "../listening/reviews";
import { CONTACT_PLACEHOLDER, suspensionEmail } from "./emails";
import { allowedDecisions, describeSubjects, excerpt, sameSubjectOpen } from "./queue";

/*
 * Moderation decisions. Each one runs in a transaction that records it in
 * `moderation_actions` (reason, author, what was judged), closes the open reports on the same
 * subject and notifies the member concerned with the reason. Suspension: the account is a
 * visitor everywhere (`ctx.user()` is null), its sessions end, its reviews, lists and comments
 * are hidden (`hidden_by = 'suspension'`, never deleted), and an email gives the reason.
 */

const { comments, lists, moderationActions, notifications, profiles, reports, reviews } = schema;

type HideableKind = "review" | "list" | "comment";
const TABLES = { review: reviews, list: lists, comment: comments } as const;

export interface Decision {
  action: ModerationActionKind;
  subject: ModerationSubject;
  reason: string;
  moderatorId: string;
  targetUserId: string | null;
  content?: { kind: HideableKind; id: string };
  reportId?: string;
  reportReason?: (typeof reports.$inferSelect)["reason"];
  excerpt: string;
  /** Tell the member concerned (not for dismissals or catalog fixes). */
  notify: boolean;
}

/** Records a decision, and its notification for the member concerned. */
export async function record(tx: DbOrTx, decision: Decision, now: Date): Promise<string> {
  const content = decision.content;
  const [row] = await tx
    .insert(moderationActions)
    .values({
      action: decision.action,
      subject: decision.subject,
      reason: decision.reason,
      reportReason: decision.reportReason ?? null,
      moderatorId: decision.moderatorId,
      targetUserId: decision.targetUserId,
      reviewId: content?.kind === "review" ? content.id : null,
      listId: content?.kind === "list" ? content.id : null,
      commentId: content?.kind === "comment" ? content.id : null,
      reportId: decision.reportId ?? null,
      excerpt: excerpt(decision.excerpt),
      createdAt: now,
    })
    .returning({ id: moderationActions.id });
  if (decision.notify && decision.targetUserId) {
    await tx.insert(notifications).values({
      userId: decision.targetUserId,
      type: "moderation",
      moderationActionId: row!.id,
      groupKey: `moderation:${row!.id}`,
      createdAt: now,
    });
  }
  return row!.id;
}

/** Text of a review, a list or a comment, for the history excerpt. */
async function contentText(tx: DbOrTx, kind: HideableKind, id: string): Promise<string> {
  if (kind === "list") {
    const [row] = await tx
      .select({ title: lists.title, description: lists.description })
      .from(lists)
      .where(eq(lists.id, id));
    return row ? [row.title, row.description].filter(Boolean).join(" — ") : "";
  }
  const table = kind === "review" ? reviews : comments;
  const [row] = await tx.select({ body: table.body }).from(table).where(eq(table.id, id));
  return row?.body ?? "";
}

async function hideContent(tx: DbOrTx, kind: HideableKind, id: string, now: Date) {
  const table = TABLES[kind];
  await tx
    .update(table)
    .set({ hiddenAt: now, hiddenBy: "moderation" })
    .where(and(eq(table.id, id), isNull(table.hiddenAt)));
}

async function deleteContent(
  tx: DbOrTx,
  kind: HideableKind,
  id: string,
  authorId: string,
  now: Date,
) {
  if (kind === "review") {
    await deleteReview(tx, authorId, id);
  } else if (kind === "list") {
    await tx.delete(lists).where(eq(lists.id, id));
  } else {
    // Comments are soft-deleted, as when their author deletes them (threads stay readable).
    await tx.update(comments).set({ deletedAt: now }).where(eq(comments.id, id));
    await tx.delete(notifications).where(eq(notifications.commentId, id));
  }
}

/** Suspends a member (not an admin): hides what they wrote and ends their sessions. */
async function suspendInTx(tx: DbOrTx, userId: string, reason: string, now: Date) {
  const [profile] = await tx
    .select({ role: profiles.role, suspendedAt: profiles.suspendedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .for("update");
  if (!profile) fail("NOT_FOUND", "MEMBER_NOT_FOUND");
  if (profile.role === "admin") fail("BAD_REQUEST", "CANNOT_MODERATE_ADMIN");
  if (profile.suspendedAt) fail("CONFLICT", "ALREADY_SUSPENDED");
  await tx
    .update(profiles)
    .set({ suspendedAt: now, suspensionReason: reason })
    .where(eq(profiles.userId, userId));
  for (const table of [reviews, lists, comments]) {
    await tx
      .update(table)
      .set({ hiddenAt: now, hiddenBy: "suspension" })
      .where(and(eq(table.userId, userId), isNull(table.hiddenAt)));
  }
  await tx.delete(schema.session).where(eq(schema.session.userId, userId));
}

/** Closes the open reports on the same subject as `report` with the decision's reason. */
async function closeReports(
  tx: DbOrTx,
  report: typeof reports.$inferSelect,
  status: "resolved" | "dismissed",
  moderatorId: string,
  note: string,
  now: Date,
) {
  await tx
    .update(reports)
    .set({ status, resolvedById: moderatorId, resolvedAt: now, resolutionNote: note })
    .where(sameSubjectOpen(report));
}

/** Context a decision needs beyond the database: the mailer and the contact address. */
export interface ModerationDeps {
  mailer: () => Mailer;
  contactEmail: string | null;
}

/** Emails the suspension reason; a failed email never undoes the decision (it is logged). */
async function sendSuspensionEmail(
  db: Db,
  deps: ModerationDeps,
  userId: string,
  reason: string,
): Promise<boolean> {
  const [row] = await db
    .select({ email: schema.user.email, locale: profiles.locale })
    .from(schema.user)
    .innerJoin(profiles, eq(profiles.userId, schema.user.id))
    .where(eq(schema.user.id, userId));
  if (!row) return false;
  try {
    const locale: Locale = row.locale === "en" ? "en" : "fr";
    await deps.mailer().send(await suspensionEmail(row.email, reason, deps.contactEmail, locale));
    return true;
  } catch (error) {
    // Message only: provider errors never carry the address or a secret, but stay brief.
    console.error(
      "[moderation] suspension email not sent:",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}

/** Applies a decision to an open report (and to the other open reports on the same subject). */
export async function decideReport(
  db: Db,
  deps: ModerationDeps,
  moderatorId: string,
  input: ReportDecisionInput,
  now: Date,
): Promise<{ emailSent: boolean | null }> {
  const suspended = await db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .for("update");
    if (!report) fail("NOT_FOUND", "REPORT_NOT_FOUND");
    const {
      subjects: [subject],
    } = await describeSubjects(tx, [report]);
    if (!subject || !allowedDecisions(report, subject).includes(input.decision)) {
      fail("BAD_REQUEST", "MODERATION_ACTION_INVALID");
    }
    const content =
      subject.contentId && subject.kind !== "member" && subject.kind !== "catalog"
        ? { kind: subject.kind, id: subject.contentId }
        : undefined;
    const base = {
      subject: subject.kind,
      reason: input.reason,
      moderatorId,
      targetUserId: subject.memberId,
      content,
      reportId: report.id,
      reportReason: report.reason,
      excerpt: subject.label,
    };
    switch (input.decision) {
      case "dismiss":
      case "resolve":
        await record(tx, { ...base, action: input.decision, notify: false }, now);
        await closeReports(
          tx,
          report,
          input.decision === "dismiss" ? "dismissed" : "resolved",
          moderatorId,
          input.reason,
          now,
        );
        return null;
      case "hide":
        await record(tx, { ...base, action: "hide", notify: true }, now);
        await closeReports(tx, report, "resolved", moderatorId, input.reason, now);
        await hideContent(tx, content!.kind, content!.id, now);
        return null;
      case "delete":
        // Recorded first: deleting a review or a list also deletes its reports (cascade);
        // the history keeps the excerpt.
        await record(tx, { ...base, action: "delete", notify: true }, now);
        await closeReports(tx, report, "resolved", moderatorId, input.reason, now);
        await deleteContent(tx, content!.kind, content!.id, subject.memberId!, now);
        return null;
      case "suspend":
        await record(tx, { ...base, action: "suspend", notify: true }, now);
        await closeReports(tx, report, "resolved", moderatorId, input.reason, now);
        await suspendInTx(tx, subject.memberId!, input.reason, now);
        return subject.memberId;
    }
  });
  if (!suspended) return { emailSent: null };
  return { emailSent: await sendSuspensionEmail(db, deps, suspended, input.reason) };
}

async function memberId(db: DbOrTx, username: string): Promise<string> {
  const [row] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = ${username.toLowerCase()}`);
  if (!row) fail("NOT_FOUND", "MEMBER_NOT_FOUND");
  return row.userId;
}

/** Suspends a member directly (no report). */
export async function suspendMember(
  db: Db,
  deps: ModerationDeps,
  moderatorId: string,
  input: MemberModerationInput,
  now: Date,
): Promise<{ emailSent: boolean }> {
  const userId = await db.transaction(async (tx) => {
    const id = await memberId(tx, input.username);
    await suspendInTx(tx, id, input.reason, now);
    await record(
      tx,
      {
        action: "suspend",
        subject: "member",
        reason: input.reason,
        moderatorId,
        targetUserId: id,
        excerpt: `@${input.username}`,
        notify: true,
      },
      now,
    );
    return id;
  });
  return { emailSent: await sendSuspensionEmail(db, deps, userId, input.reason) };
}

/** Lifts a suspension: the account works again and what the suspension hid comes back. */
export async function unsuspendMember(
  db: Db,
  moderatorId: string,
  input: MemberModerationInput,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const id = await memberId(tx, input.username);
    const [profile] = await tx
      .select({ suspendedAt: profiles.suspendedAt })
      .from(profiles)
      .where(eq(profiles.userId, id))
      .for("update");
    if (!profile?.suspendedAt) fail("CONFLICT", "NOT_SUSPENDED");
    await tx
      .update(profiles)
      .set({ suspendedAt: null, suspensionReason: null })
      .where(eq(profiles.userId, id));
    // Content hidden by a decision of its own stays hidden.
    for (const table of [reviews, lists, comments]) {
      await tx
        .update(table)
        .set({ hiddenAt: null, hiddenBy: null })
        .where(and(eq(table.userId, id), eq(table.hiddenBy, "suspension")));
    }
    await record(
      tx,
      {
        action: "unsuspend",
        subject: "member",
        reason: input.reason,
        moderatorId,
        targetUserId: id,
        excerpt: `@${input.username}`,
        notify: true,
      },
      now,
    );
  });
}

/** Shows again a review, a list or a comment hidden by a moderation decision. */
export async function restoreContent(
  db: Db,
  moderatorId: string,
  input: RestoreContentInput,
  now: Date,
): Promise<void> {
  const { kind, id } = input.subject;
  const table = TABLES[kind];
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(table)
      .set({ hiddenAt: null, hiddenBy: null })
      .where(and(eq(table.id, id), eq(table.hiddenBy, "moderation")))
      .returning({ userId: table.userId });
    if (!row) fail("BAD_REQUEST", "MODERATION_ACTION_INVALID");
    await record(
      tx,
      {
        action: "restore",
        subject: kind,
        reason: input.reason,
        moderatorId,
        targetUserId: row.userId,
        content: { kind, id },
        excerpt: await contentText(tx, kind, id),
        notify: true,
      },
      now,
    );
  });
}

/** The caller's suspension, for the "account suspended" page (null when not suspended). */
export async function mySuspension(
  db: Db,
  account: Account,
  contactEmail: string | null,
): Promise<MySuspension | null> {
  if (!account.suspendedAt) return null;
  const [profile] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.userId, account.user.id));
  return {
    username: profile?.username ?? "",
    suspendedAt: account.suspendedAt.toISOString(),
    reason: account.suspensionReason ?? "",
    contactEmail: contactEmail ?? CONTACT_PLACEHOLDER,
  };
}
