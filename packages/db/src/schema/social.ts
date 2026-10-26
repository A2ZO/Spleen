import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, exactlyOne, id, timestamps } from "./_shared";
import { user } from "./auth";
import { hiddenColumns, lists, reviews } from "./content";
import { targetColumns } from "./target";

const userRef = (name: string) => uuid(name).references(() => user.id, { onDelete: "cascade" });

export const follows = pgTable(
  "follows",
  {
    followerId: userRef("follower_id").notNull(),
    followeeId: userRef("followee_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    // Followers / following pages, newest first (cursor on created_at).
    index("follows_follower_created_idx").on(t.followerId, t.createdAt.desc()),
    index("follows_followee_created_idx").on(t.followeeId, t.createdAt.desc()),
    check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
  ],
);

/** Likes on a review or a list (exactly one). */
export const likes = pgTable(
  "likes",
  {
    id: id(),
    userId: userRef("user_id").notNull(),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => lists.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    check("likes_one_subject", exactlyOne(t.reviewId, t.listId)),
    uniqueIndex("likes_user_review_uidx")
      .on(t.userId, t.reviewId)
      .where(sql`${t.reviewId} is not null`),
    uniqueIndex("likes_user_list_uidx")
      .on(t.userId, t.listId)
      .where(sql`${t.listId} is not null`),
    index("likes_review_idx").on(t.reviewId),
    index("likes_list_idx").on(t.listId),
    // Popular tab: likes of the week.
    index("likes_created_idx").on(t.createdAt),
  ],
);

/** Comments on a review or a list (exactly one). Soft-deleted to keep threads readable. */
export const comments = pgTable(
  "comments",
  {
    id: id(),
    userId: userRef("user_id").notNull(),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => lists.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Set when the author edits the text (shown as "edited"). */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...hiddenColumns(),
    ...timestamps(),
  },
  (t) => [
    check("comments_one_subject", exactlyOne(t.reviewId, t.listId)),
    check("comments_hidden_pair", sql`(${t.hiddenAt} is null) = (${t.hiddenBy} is null)`),
    index("comments_review_idx").on(t.reviewId, t.createdAt),
    index("comments_list_idx").on(t.listId, t.createdAt),
    index("comments_user_idx").on(t.userId),
    // Popular tab: comments of the week.
    index("comments_created_idx").on(t.createdAt),
  ],
);

export const notificationType = pgEnum("notification_type", [
  "follow",
  "like",
  "comment",
  "moderation",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    /** Recipient. */
    userId: userRef("user_id").notNull(),
    actorId: userRef("actor_id"),
    type: notificationType("type").notNull(),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => lists.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    /** A moderation decision about the recipient or their content (its reason is shown). */
    moderationActionId: uuid("moderation_action_id").references(() => moderationActions.id, {
      onDelete: "cascade",
    }),
    /**
     * Similar notifications share a key and show as one ("Camille and 3 others liked your
     * review"): likes and comments per subject, follows per day (`lib/social/notifications.ts`).
     */
    groupKey: text("group_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("notifications_user_group_idx").on(t.userId, t.groupKey),
    index("notifications_unread_idx")
      .on(t.userId)
      .where(sql`${t.readAt} is null`),
    // One follow / like notification per actor and subject (liking again adds nothing).
    uniqueIndex("notifications_once_uidx")
      .on(t.userId, t.actorId, t.type, sql`coalesce(${t.reviewId}, ${t.listId}, ${t.userId})`)
      .where(sql`${t.type} in ('follow', 'like')`),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: userRef("blocker_id").notNull(),
    blockedId: userRef("blocked_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_idx").on(t.blockedId),
    check("blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

export const reportReason = pgEnum("report_reason", [
  "spam",
  "harassment",
  "hate",
  "spoiler",
  "inappropriate",
  "catalog_error",
  "catalog_addition",
  "other",
]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

/**
 * Reports on a member, a review, a list, a comment or a catalog item. A catalog addition
 * proposal may have no subject at all (the item does not exist yet).
 */
export const reports = pgTable(
  "reports",
  {
    id: id(),
    /** Null once the reporter deleted their account: the report stays for moderation. */
    reporterId: uuid("reporter_id").references(() => user.id, { onDelete: "set null" }),
    reportedUserId: userRef("reported_user_id"),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    listId: uuid("list_id").references(() => lists.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    ...targetColumns(),
    reason: reportReason("reason").notNull(),
    details: text("details").notNull().default(""),
    status: reportStatus("status").notNull().default("open"),
    /** Kept when the moderator is deleted, so the moderation history survives. */
    resolvedById: uuid("resolved_by_id").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    ...timestamps(),
  },
  (t) => [
    check(
      "reports_one_subject",
      sql`${exactlyOne(t.reportedUserId, t.reviewId, t.listId, t.commentId, t.releaseId, t.trackId, t.artistId)} or (${t.reason} = 'catalog_addition' and num_nonnulls(${t.reportedUserId}, ${t.reviewId}, ${t.listId}, ${t.commentId}, ${t.releaseId}, ${t.trackId}, ${t.artistId}) = 0)`,
    ),
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_reporter_idx").on(t.reporterId),
    // Reporting the same thing twice while the first report is open adds nothing.
    uniqueIndex("reports_open_once_uidx")
      .on(
        t.reporterId,
        sql`coalesce(${t.reportedUserId}, ${t.reviewId}, ${t.listId}, ${t.commentId}, ${t.releaseId}, ${t.trackId}, ${t.artistId})`,
      )
      .where(sql`${t.status} = 'open' and ${t.reporterId} is not null`),
  ],
);

export const moderationActionKind = pgEnum("moderation_action_kind", [
  "dismiss",
  "resolve",
  "hide",
  "restore",
  "delete",
  "suspend",
  "unsuspend",
]);
export const moderationSubject = pgEnum("moderation_subject", [
  "member",
  "review",
  "list",
  "comment",
  "catalog",
]);

/**
 * Moderation history: every decision with its reason and its author. Kept when the content,
 * the member or the moderator is deleted (links set to null, `excerpt` keeps what was
 * judged). A year after the decision it is anonymised (`anonymized_at`): the action, its
 * reason and the report category stay, every link to a person and the excerpt go.
 */
export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: id(),
    action: moderationActionKind("action").notNull(),
    subject: moderationSubject("subject").notNull(),
    reason: text("reason").notNull(),
    /** Category of the report that led to the decision, if any. */
    reportReason: reportReason("report_reason"),
    moderatorId: uuid("moderator_id").references(() => user.id, { onDelete: "set null" }),
    /** The member sanctioned or whose content was judged. */
    targetUserId: uuid("target_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "set null" }),
    listId: uuid("list_id").references(() => lists.id, { onDelete: "set null" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "set null" }),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    excerpt: text("excerpt").notNull().default(""),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("moderation_actions_created_idx").on(t.createdAt.desc()),
    index("moderation_actions_target_idx").on(t.targetUserId),
    index("moderation_actions_anonymize_idx")
      .on(t.createdAt)
      .where(sql`${t.anonymizedAt} is null`),
  ],
);
