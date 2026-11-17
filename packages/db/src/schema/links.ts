import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { id, timestamps } from "./_shared";
import { targetCheck, targetColumns } from "./target";

/*
 * "Listen on" direct links, derived from MusicBrainz URL relationships (docs/catalogue.md).
 * One link per entity and service; validated before being stored and again before being shown.
 * In its own file: `target.ts` imports the catalog tables.
 */

export const listenService = pgEnum("listen_service", [
  "spotify",
  "deezer",
  "apple_music",
  "youtube_music",
  "bandcamp",
]);

export const listenLinks = pgTable(
  "listen_links",
  {
    id: id(),
    ...targetColumns(),
    service: listenService("service").notNull(),
    url: text("url").notNull(),
    ...timestamps(),
  },
  (t) => [
    targetCheck("listen_links", t),
    check("listen_links_https", sql`${t.url} like 'https://%'`),
    uniqueIndex("listen_links_release_uidx")
      .on(t.releaseId, t.service)
      .where(sql`${t.releaseId} is not null`),
    uniqueIndex("listen_links_track_uidx")
      .on(t.trackId, t.service)
      .where(sql`${t.trackId} is not null`),
    uniqueIndex("listen_links_artist_uidx")
      .on(t.artistId, t.service)
      .where(sql`${t.artistId} is not null`),
  ],
);
