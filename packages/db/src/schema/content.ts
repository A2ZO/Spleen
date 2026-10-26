import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { id, rating, ratingCheck, timestamps } from "./_shared";
import { user } from "./auth";
import { releases } from "./catalog";
import { entries } from "./listening";
import { targetCheck, targetColumns } from "./target";

/** Reviews are independent from ratings: a review may have no rating and vice versa. */
export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Diary entry the review was written with, if any. */
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    ...targetColumns(),
    /** Rating snapshot shown on the review card (the entry may change later). */
    rating: rating(),
    body: text("body").notNull(),
    lang: varchar("lang", { length: 8 }).notNull(),
    /** Spleen+ pinned review, prepared for later. */
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    targetCheck("reviews", t),
    ratingCheck("reviews", t.rating),
    index("reviews_user_idx").on(t.userId, t.createdAt.desc()),
    // Popular tab: reviews split by language.
    index("reviews_lang_created_idx").on(t.lang, t.createdAt.desc()),
    index("reviews_release_idx").on(t.releaseId),
    index("reviews_track_idx").on(t.trackId),
    index("reviews_artist_idx").on(t.artistId),
  ],
);

export const lists = pgTable(
  "lists",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    ranked: boolean("ranked").notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("lists_user_idx").on(t.userId, t.updatedAt.desc())],
);

/** List items can mix albums, tracks and artists. */
export const listItems = pgTable(
  "list_items",
  {
    id: id(),
    listId: uuid("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    ...targetColumns(),
    position: integer("position").notNull(),
    note: text("note"),
  },
  (t) => [
    targetCheck("list_items", t),
    index("list_items_list_position_idx").on(t.listId, t.position),
    // An item is in a list at most once (NULLs are distinct: one per target kind).
    unique("list_items_list_release_unique").on(t.listId, t.releaseId),
    unique("list_items_list_track_unique").on(t.listId, t.trackId),
    unique("list_items_list_artist_unique").on(t.listId, t.artistId),
    index("list_items_release_idx").on(t.releaseId),
    index("list_items_track_idx").on(t.trackId),
    index("list_items_artist_idx").on(t.artistId),
  ],
);

/** The Shelf: 4 favourite releases, positions 1 to 4. */
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.position] }),
    unique("favorites_user_release_unique").on(t.userId, t.releaseId),
    check("favorites_position_range", sql`${t.position} between 1 and 4`),
  ],
);
