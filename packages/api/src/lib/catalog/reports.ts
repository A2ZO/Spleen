import { eq, schema, type Db } from "@spleen/db";
import type { CatalogReportInput, CatalogReportType } from "@spleen/validators";

import { fail } from "../../trpc";
import { requireListener } from "../listening/targets";
import { findBySlug } from "./merge";

const { artists, releases, reports, tracks } = schema;

const REASONS: Record<CatalogReportType, (typeof reports.$inferSelect)["reason"]> = {
  error: "catalog_error",
  cover: "catalog_cover",
  duplicate: "catalog_duplicate",
  addition: "catalog_addition",
  other: "other",
};

const TARGET = {
  release: { table: releases, column: "releaseId", duplicate: "duplicateReleaseId" },
  track: { table: tracks, column: "trackId", duplicate: "duplicateTrackId" },
  artist: { table: artists, column: "artistId", duplicate: "duplicateArtistId" },
} as const;

/**
 * "Report an error / suggest an addition" on a catalog page. A duplicate names the other page,
 * of the same kind and not merged already; admins can then merge the two from the queue. The
 * same open report twice adds nothing.
 */
export async function createCatalogReport(
  db: Db,
  userId: string,
  input: CatalogReportInput,
  now: Date,
): Promise<void> {
  await requireListener(db, userId);
  const target = TARGET[input.target.kind];
  const [row] = await db
    .select({ id: target.table.id, mergedIntoId: target.table.mergedIntoId })
    .from(target.table as typeof releases)
    .where(eq(target.table.id, input.target.id));
  if (!row || row.mergedIntoId) fail("NOT_FOUND", "ITEM_NOT_FOUND");
  let duplicate: Record<string, string> = {};
  if (input.type === "duplicate") {
    const other = await findBySlug(db, input.target.kind, input.duplicate ?? "");
    if (!other || other.mergedIntoId) fail("BAD_REQUEST", "DUPLICATE_NOT_FOUND");
    if (other.id === row.id) fail("BAD_REQUEST", "MERGE_SAME");
    duplicate = { [target.duplicate]: other.id };
  }
  await db
    .insert(reports)
    .values({
      reporterId: userId,
      [target.column]: row.id,
      ...duplicate,
      reason: REASONS[input.type],
      details: input.details,
      createdAt: now,
    })
    .onConflictDoNothing();
}
