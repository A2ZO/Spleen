import { and, desc, eq, gt, isNull, lt, ne, or, schema, sql, type Db } from "@spleen/db";
import { isReservedUsername, usernameSchema } from "@spleen/validators";

/** A former username stays reserved this long; renames are limited to one per period. */
export const USERNAME_RESERVATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const reservationCutoff = (now: Date) =>
  new Date(now.getTime() - USERNAME_RESERVATION_DAYS * DAY_MS);

export type UsernameStatus = "available" | "invalid" | "reserved" | "taken";

/**
 * Whether `username` can be taken by `userId` (null for an anonymous check).
 * Taken: another profile has it (case-insensitive). Reserved: a word we keep, or someone
 * else left it (rename or deleted account) less than 30 days ago. A member may always take
 * back their own former usernames.
 */
export async function usernameStatus(
  db: Db,
  raw: string,
  userId: string | null,
  now: Date,
): Promise<UsernameStatus> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  const username = parsed.data;
  if (isReservedUsername(username)) return "reserved";

  const owner = await db
    .select({ userId: schema.profiles.userId })
    .from(schema.profiles)
    .where(sql`lower(${schema.profiles.username}) = ${username}`)
    .limit(1);
  if (owner[0] && owner[0].userId !== userId) return "taken";

  const h = schema.usernameHistory;
  const heldByOthers = await db
    .select({ id: h.id })
    .from(h)
    .where(
      and(
        sql`lower(${h.username}) = ${username}`,
        gt(h.changedAt, reservationCutoff(now)),
        userId ? or(isNull(h.userId), ne(h.userId, userId)) : undefined,
      ),
    )
    .limit(1);
  return heldByOthers.length > 0 ? "reserved" : "available";
}

/** Date from which `userId` may rename again, or null if they may now. */
export async function nextRenameAt(db: Db, userId: string, now: Date): Promise<Date | null> {
  const h = schema.usernameHistory;
  const [last] = await db
    .select({ changedAt: h.changedAt })
    .from(h)
    .where(eq(h.userId, userId))
    .orderBy(desc(h.changedAt))
    .limit(1);
  if (!last) return null;
  const next = new Date(last.changedAt.getTime() + USERNAME_RESERVATION_DAYS * DAY_MS);
  return next > now ? next : null;
}

/**
 * Deletes reservations left by deleted accounts once they expire: nothing ties them to a
 * person, and they serve no purpose after 30 days. Runs whenever a username is claimed.
 */
export async function purgeExpiredAnonymousReservations(db: Db, now: Date): Promise<void> {
  const h = schema.usernameHistory;
  await db.delete(h).where(and(isNull(h.userId), lt(h.changedAt, reservationCutoff(now))));
}
