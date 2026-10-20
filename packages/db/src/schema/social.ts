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
import { lists, reviews } from "./content";
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
    index("follows_followee_idx").on(t.followeeId),
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check("comments_one_subject", exactlyOne(t.reviewId, t.listId)),
    index("comments_review_idx").on(t.reviewId, t.createdAt),
    index("comments_list_idx").on(t.listId, t.createdAt),
  ],
);

export const notificationType = pgEnum("notification_type", ["follow", "like", "comment"]);

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
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt.desc())],
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
    reporterId: userRef("reporter_id").notNull(),
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
  ],
);
