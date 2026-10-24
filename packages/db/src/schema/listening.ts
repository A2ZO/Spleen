import { listenFormats } from "@spleen/validators";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, rating, ratingCheck, timestamps } from "./_shared";
import { user } from "./auth";
import { tracks } from "./catalog";
import { targetCheck, targetColumns } from "./target";

export const listenFormat = pgEnum("listen_format", listenFormats);

/**
 * The diary: one row per listen. `listened_on` is null for the member's single "undated"
 * listen of a target (quick rating or heart from an item page): it counts for the current
 * state and all-time totals, but stays out of the diary, the calendar and per-year stats.
 */
export const entries = pgTable(
  "entries",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...targetColumns(),
    listenedOn: date("listened_on"),
    rating: rating(),
    liked: boolean("liked").notNull().default(false),
    isRelisten: boolean("is_relisten").notNull().default(false),
    format: listenFormat("format"),
    ...timestamps(),
  },
  (t) => [
    targetCheck("entries", t),
    ratingCheck("entries", t.rating),
    index("entries_user_listened_idx").on(t.userId, t.listenedOn.desc()),
    index("entries_release_idx").on(t.releaseId),
    index("entries_track_idx").on(t.trackId),
    index("entries_artist_idx").on(t.artistId),
    uniqueIndex("entries_undated_release_uidx")
      .on(t.userId, t.releaseId)
      .where(sql`${t.listenedOn} is null and ${t.releaseId} is not null`),
    uniqueIndex("entries_undated_track_uidx")
      .on(t.userId, t.trackId)
      .where(sql`${t.listenedOn} is null and ${t.trackId} is not null`),
  ],
);

/** Moods: suggested ones (owner null, translated labels) and personal ones. */
export const moods = pgTable(
  "moods",
  {
    id: id(),
    slug: text("slug").notNull(),
    ownerId: uuid("owner_id").references(() => user.id, { onDelete: "cascade" }),
    labelFr: text("label_fr").notNull(),
    labelEn: text("label_en").notNull(),
  },
  (t) => [
    uniqueIndex("moods_suggested_slug_uidx")
      .on(t.slug)
      .where(sql`${t.ownerId} is null`),
    uniqueIndex("moods_owner_slug_uidx")
      .on(t.ownerId, t.slug)
      .where(sql`${t.ownerId} is not null`),
  ],
);

export const entryMoods = pgTable(
  "entry_moods",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    moodId: uuid("mood_id")
      .notNull()
      .references(() => moods.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.moodId] }),
    index("entry_moods_mood_idx").on(t.moodId),
  ],
);

/** Track-by-track ratings attached to an album entry (they suggest the album rating). */
export const trackRatings = pgTable(
  "track_ratings",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),
    rating: rating().notNull(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.trackId] }), ratingCheck("track_ratings", t.rating)],
);

/** Latest state per member and target, for fast item pages. Derived from entries. */
export const userItemState = pgTable(
  "user_item_state",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...targetColumns(),
    rating: rating(),
    liked: boolean("liked").notNull().default(false),
    /** When the heart was last given (a heart removed then given again gets the new date). */
    likedAt: timestamp("liked_at", { withTimezone: true }),
    listened: boolean("listened").notNull().default(false),
    wantToListen: boolean("want_to_listen").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    targetCheck("user_item_state", t),
    ratingCheck("user_item_state", t.rating),
    uniqueIndex("user_item_state_release_uidx")
      .on(t.userId, t.releaseId)
      .where(sql`${t.releaseId} is not null`),
    uniqueIndex("user_item_state_track_uidx")
      .on(t.userId, t.trackId)
      .where(sql`${t.trackId} is not null`),
    uniqueIndex("user_item_state_artist_uidx")
      .on(t.userId, t.artistId)
      .where(sql`${t.artistId} is not null`),
    index("user_item_state_release_idx").on(t.releaseId),
    index("user_item_state_track_idx").on(t.trackId),
    index("user_item_state_artist_idx").on(t.artistId),
    // Profile "Hearts" tab: liked releases, most recently liked first.
    index("user_item_state_liked_idx")
      .on(t.userId, t.likedAt.desc())
      .where(sql`${t.liked} and ${t.releaseId} is not null`),
  ],
);
