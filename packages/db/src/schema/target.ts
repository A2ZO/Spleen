import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { check, uuid } from "drizzle-orm/pg-core";

import { exactlyOne } from "./_shared";
import { artists, releases, tracks } from "./catalog";

/**
 * A "target" is an album/EP/single, a track or an artist: three nullable real foreign keys
 * plus a CHECK that exactly one is set (see `targetCheck`). No FK-less polymorphism.
 * Catalog rows are never hard-deleted: duplicate merges re-point references first.
 */
export const targetColumns = () => ({
  releaseId: uuid("release_id").references((): AnyPgColumn => releases.id, {
    onDelete: "restrict",
  }),
  trackId: uuid("track_id").references((): AnyPgColumn => tracks.id, { onDelete: "restrict" }),
  artistId: uuid("artist_id").references((): AnyPgColumn => artists.id, { onDelete: "restrict" }),
});

export const targetCheck = (
  table: string,
  t: { releaseId: AnyPgColumn; trackId: AnyPgColumn; artistId: AnyPgColumn },
) => check(`${table}_one_target`, exactlyOne(t.releaseId, t.trackId, t.artistId));
