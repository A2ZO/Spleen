import { z } from "zod";

import { usernameSchema } from "./profile";

export const COMMENT_BODY_MAX = 1_000;
export const REPORT_DETAILS_MAX = 500;

export const commentBodySchema = z.string().trim().min(1).max(COMMENT_BODY_MAX);

/** Opaque pagination cursor returned by the API ("next page starts after this"). */
export const cursorSchema = z.string().min(1).max(200);

/** Something members like and comment on: a review or a list. */
export const socialSubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("review"), id: z.uuid() }),
  z.object({ kind: z.literal("list"), id: z.uuid() }),
]);
export type SocialSubjectInput = z.infer<typeof socialSubjectSchema>;

export const likeSetSchema = z.object({ subject: socialSubjectSchema, liked: z.boolean() });

export const commentListSchema = z.object({
  subject: socialSubjectSchema,
  cursor: cursorSchema.optional(),
});
export const commentCreateSchema = z.object({
  subject: socialSubjectSchema,
  body: commentBodySchema,
});
export const commentUpdateSchema = z.object({ id: z.uuid(), body: commentBodySchema });

export const memberSchema = z.object({ username: usernameSchema });
export const memberPageSchema = z.object({
  username: usernameSchema,
  cursor: cursorSchema.optional(),
});
export const cursorPageSchema = z.object({ cursor: cursorSchema.optional() });

/** Reasons a member can pick when reporting a review, a comment, a list or a profile. */
export const memberReportReasons = [
  "spam",
  "harassment",
  "hate",
  "spoiler",
  "inappropriate",
  "other",
] as const;
export type MemberReportReason = (typeof memberReportReasons)[number];

export const reportCreateSchema = z.object({
  subject: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("review"), id: z.uuid() }),
    z.object({ kind: z.literal("comment"), id: z.uuid() }),
    z.object({ kind: z.literal("list"), id: z.uuid() }),
    z.object({ kind: z.literal("member"), username: usernameSchema }),
  ]),
  reason: z.enum(memberReportReasons),
  details: z.string().trim().max(REPORT_DETAILS_MAX).default(""),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
