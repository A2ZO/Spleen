import { z } from "zod";

import { pageNumberSchema, usernameSchema } from "./profile";
import { catalogKinds } from "./social";

/** Every decision states its reason: it is kept in the history and sent to the member. */
export const MODERATION_REASON_MIN = 3;
export const MODERATION_REASON_MAX = 1_000;
export const moderationReasonSchema = z
  .string()
  .trim()
  .min(MODERATION_REASON_MIN)
  .max(MODERATION_REASON_MAX);

export const reportStatuses = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

/** What a report is about, as filtered in the queue (catalog = album, track, artist, addition). */
export const reportKinds = ["member", "review", "list", "comment", "catalog"] as const;
export type ReportKind = (typeof reportKinds)[number];

export const reportQueueSchema = z.object({
  status: z.enum([...reportStatuses, "all"]).default("open"),
  kind: z.enum([...reportKinds, "all"]).default("all"),
  page: pageNumberSchema.default(1),
});
export type ReportQueueInput = z.infer<typeof reportQueueSchema>;

/**
 * Decisions on a report. `dismiss` closes it without action; `resolve` closes a catalog report
 * (fixed or noted); `hide` and `delete` act on a review, a list or a comment; `suspend` acts on
 * the reported member, or on the author of the reported content.
 */
export const reportDecisions = ["dismiss", "resolve", "hide", "delete", "suspend"] as const;
export type ReportDecision = (typeof reportDecisions)[number];

export const reportDecisionSchema = z.object({
  reportId: z.uuid(),
  decision: z.enum(reportDecisions),
  reason: moderationReasonSchema,
});
export type ReportDecisionInput = z.infer<typeof reportDecisionSchema>;

/** Suspending or reinstating a member directly (from the suspended members list). */
export const memberModerationSchema = z.object({
  username: usernameSchema,
  reason: moderationReasonSchema,
});
export type MemberModerationInput = z.infer<typeof memberModerationSchema>;

/** Showing again a review, a list or a comment hidden by a moderation decision. */
export const restoreContentSchema = z.object({
  subject: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("review"), id: z.uuid() }),
    z.object({ kind: z.literal("list"), id: z.uuid() }),
    z.object({ kind: z.literal("comment"), id: z.uuid() }),
  ]),
  reason: moderationReasonSchema,
});
export type RestoreContentInput = z.infer<typeof restoreContentSchema>;

/**
 * Merging two catalog pages of the same kind: `duplicate` points to `keep` from then on.
 * Pages are named by slug; `reportId`, a duplicate report the merge closes.
 */
export const catalogMergeTargetSchema = z.object({
  kind: z.enum(catalogKinds),
  keep: z.string().trim().min(1).max(500),
  duplicate: z.string().trim().min(1).max(500),
});
export type CatalogMergeTargetInput = z.infer<typeof catalogMergeTargetSchema>;
export const catalogMergeSchema = catalogMergeTargetSchema.extend({
  reason: moderationReasonSchema,
  reportId: z.uuid().optional(),
});
export type CatalogMergeInput = z.infer<typeof catalogMergeSchema>;

export const moderationHistorySchema = z.object({ page: pageNumberSchema.default(1) });
