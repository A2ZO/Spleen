import { and, asc, eq, isNull, or, schema, slugify, type Db } from "@spleen/db";
import { PERSONAL_MOODS_MAX } from "@spleen/validators";

import { fail } from "../../trpc";
import type { MoodRef } from "../../types";

const { moods } = schema;

const toMoodRef = (row: typeof moods.$inferSelect): MoodRef => ({
  id: row.id,
  slug: row.slug,
  labelFr: row.labelFr,
  labelEn: row.labelEn,
  personal: row.ownerId !== null,
});

/** Suggested moods (seed order) then the member's own, alphabetically. */
export async function listMoods(db: Db, userId: string | null): Promise<MoodRef[]> {
  const rows = await db
    .select()
    .from(moods)
    .where(userId ? or(isNull(moods.ownerId), eq(moods.ownerId, userId)) : isNull(moods.ownerId))
    .orderBy(asc(moods.ownerId), asc(moods.id));
  const suggested = rows.filter((r) => r.ownerId === null);
  const personal = rows
    .filter((r) => r.ownerId !== null)
    .sort((a, b) => a.labelFr.localeCompare(b.labelFr));
  return [...suggested, ...personal].map(toMoodRef);
}

/** Creates a personal mood (same label in both languages), or returns the existing one. */
export async function createMood(db: Db, userId: string, label: string): Promise<MoodRef> {
  const slug = slugify(label) || "mood";
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(moods)
      .where(and(eq(moods.ownerId, userId), eq(moods.slug, slug)));
    if (existing) return toMoodRef(existing);
    if ((await tx.$count(moods, eq(moods.ownerId, userId))) >= PERSONAL_MOODS_MAX) {
      fail("BAD_REQUEST", "MOOD_LIMIT");
    }
    const [row] = await tx
      .insert(moods)
      .values({ slug, ownerId: userId, labelFr: label, labelEn: label })
      .returning();
    return toMoodRef(row!);
  });
}
