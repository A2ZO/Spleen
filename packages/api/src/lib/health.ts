import type { Db } from "@spleen/db";
import { releases } from "@spleen/db/schema";

export interface Health {
  ok: true;
  releases: number;
}

/** Proves the database answers (and is migrated) with one cheap query. */
export async function checkHealth(db: Db): Promise<Health> {
  return { ok: true, releases: await db.$count(releases) };
}
