import { and, eq, rowsOf, schema, sql, type DbOrTx, type ListenTarget } from "@spleen/db";
import { DEFAULT_TIME_ZONE, todayIn, type ListenTargetInput } from "@spleen/validators";

import { fail } from "../../trpc";
import { upcomingSql } from "../catalog/upcoming";

const { profiles, releases, tracks } = schema;

export function toTarget(input: ListenTargetInput): ListenTarget {
  return input.kind === "release" ? { releaseId: input.id } : { trackId: input.id };
}

/** Checks that the release or track exists. */
export async function requireTarget(db: DbOrTx, input: ListenTargetInput): Promise<ListenTarget> {
  const table = input.kind === "release" ? releases : tracks;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, input.id));
  if (!row) fail("NOT_FOUND", "ITEM_NOT_FOUND");
  return toTarget(input);
}

/** `where` clause on a table with target columns, for one member and one target. */
export function targetWhere(
  table: typeof schema.entries | typeof schema.userItemState,
  userId: string,
  target: ListenTarget,
) {
  return and(
    eq(table.userId, userId),
    "releaseId" in target
      ? eq(table.releaseId, target.releaseId)
      : eq(table.trackId, target.trackId),
  );
}

/** Settings of the member that shape listening (time zone, blind listening). */
export async function requireListener(db: DbOrTx, userId: string) {
  const [row] = await db
    .select({ timeZone: profiles.timeZone, blindMode: profiles.blindMode })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  if (!row) fail("PRECONDITION_FAILED", "PROFILE_REQUIRED");
  return row;
}

/**
 * A record not out yet (the upcoming rule, the member's today) takes no listen, rating, heart
 * or review: RELEASE_NOT_OUT. Tracks are not concerned (a single may come before its album);
 * removing something and "Want to listen" stay allowed (docs/ecoute.md).
 */
export async function requireReleased(
  db: DbOrTx,
  target: ListenTarget,
  timeZone: string | null | undefined,
  now: Date,
): Promise<void> {
  if (!("releaseId" in target)) return;
  const today = todayIn(timeZone || DEFAULT_TIME_ZONE, now);
  const rows = rowsOf<{ id: string }>(
    await db.execute(sql`
      select r.id from releases r where r.id = ${target.releaseId} and ${upcomingSql(today)}
    `),
  );
  if (rows.length > 0) fail("BAD_REQUEST", "RELEASE_NOT_OUT");
}
