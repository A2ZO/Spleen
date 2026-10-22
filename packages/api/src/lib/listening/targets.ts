import { and, eq, schema, type DbOrTx, type ListenTarget } from "@spleen/db";
import type { ListenTargetInput } from "@spleen/validators";

import { fail } from "../../trpc";

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
