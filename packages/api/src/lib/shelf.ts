import { and, eq, schema, type Db } from "@spleen/db";
import { SHELF_SIZE } from "@spleen/validators";

import { fail } from "../trpc";
import type { ReleaseCard } from "../types";
import { loadReleaseCards, toReleaseCard } from "./catalog/cards";
import { requireListener, requireTarget } from "./listening/targets";

/*
 * The Shelf: a member's 4 favourite records (albums, EPs or singles), one per slot 1..4.
 * A record is on it at most once: putting it in another slot moves it there.
 */

const { favorites } = schema;

/** Always `SHELF_SIZE` slots, slot 1 first; null = empty slot. */
export async function getShelf(db: Db, userId: string): Promise<(ReleaseCard | null)[]> {
  const rows = await db
    .select({ position: favorites.position, releaseId: favorites.releaseId })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  const cards = new Map(
    (
      await loadReleaseCards(
        db,
        rows.map((r) => r.releaseId),
      )
    ).map((c) => [c.id, toReleaseCard(c)]),
  );
  return Array.from({ length: SHELF_SIZE }, (_, i) => {
    const row = rows.find((r) => r.position === i + 1);
    return row ? (cards.get(row.releaseId) ?? null) : null;
  });
}

/** Puts a record in a slot, replacing what was there; moves it if already on the Shelf. */
export async function setShelfItem(
  db: Db,
  userId: string,
  input: { releaseId: string; position: number },
): Promise<void> {
  await requireListener(db, userId);
  await db.transaction(async (tx) => {
    await requireTarget(tx, { kind: "release", id: input.releaseId });
    await tx
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.releaseId, input.releaseId)));
    await tx
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.position, input.position)));
    await tx.insert(favorites).values({ userId, ...input });
  });
}

export async function removeShelfItem(db: Db, userId: string, position: number): Promise<void> {
  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.position, position)));
}

/** New order of the same records (slot 1 first); adding or dropping one is refused. */
export async function reorderShelf(
  db: Db,
  userId: string,
  releaseIds: (string | null)[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ releaseId: favorites.releaseId })
      .from(favorites)
      .where(eq(favorites.userId, userId));
    const wanted = releaseIds.filter((id): id is string => id !== null);
    const same =
      new Set(wanted).size === wanted.length &&
      wanted.length === current.length &&
      current.every((r) => wanted.includes(r.releaseId));
    if (!same) fail("CONFLICT", "SHELF_MISMATCH");
    await tx.delete(favorites).where(eq(favorites.userId, userId));
    const rows = releaseIds.flatMap((releaseId, i) =>
      releaseId ? [{ userId, releaseId, position: i + 1 }] : [],
    );
    if (rows.length > 0) await tx.insert(favorites).values(rows);
  });
}
