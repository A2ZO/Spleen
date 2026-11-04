import { and, desc, eq, inArray, schema, sql, type DbOrTx } from "@spleen/db";

import type { ModerationHold } from "../../types";
import { CONTACT_PLACEHOLDER } from "./emails";

/*
 * Content hidden by moderation stays visible to its author alone, with the reason of the
 * decision and where to contest it. Everyone else never sees it.
 */

const { moderationActions } = schema;

type HoldColumn = "reviewId" | "listId" | "commentId";

/**
 * Reason of the latest "hide" decision on each content (absent from the map when there is none
 * left, e.g. after anonymisation: the banner then shows no reason).
 */
export async function hideReasons(
  db: DbOrTx,
  column: HoldColumn,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const ref = moderationActions[column];
  const rows = await db
    .selectDistinctOn([ref], { id: sql<string>`${ref}`, reason: moderationActions.reason })
    .from(moderationActions)
    .where(and(eq(moderationActions.action, "hide"), inArray(ref, ids)))
    .orderBy(ref, desc(moderationActions.createdAt));
  return new Map(rows.map((r) => [r.id, r.reason]));
}

/** The hold shown on one hidden content (null when it is not hidden). */
export async function moderationHold(
  db: DbOrTx,
  column: HoldColumn,
  id: string,
  hidden: boolean,
  contactEmail: string | null,
): Promise<ModerationHold | null> {
  if (!hidden) return null;
  const reasons = await hideReasons(db, column, [id]);
  return { reason: reasons.get(id) ?? null, contactEmail: contactEmail ?? CONTACT_PLACEHOLDER };
}
