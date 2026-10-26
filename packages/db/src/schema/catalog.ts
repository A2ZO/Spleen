import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { id, searchable, timestamps } from "./_shared";

/* MusicBrainz mapping: release-group = release (album / EP / single), recording = track. */

/**
 * Duplicate merges: a merged row is never deleted, it points to the row kept (its old URL
 * redirects there, imports follow the link). Always one step: merging into a row re-points
 * the rows merged into it.
 */
const mergedInto = (target: () => AnyPgColumn) =>
  uuid("merged_into_id").references(target, { onDelete: "restrict" });
const notMergedIntoItself = (table: string, t: { id: AnyPgColumn; mergedIntoId: AnyPgColumn }) =>
  check(`${table}_not_merged_into_itself`, sql`${t.mergedIntoId} <> ${t.id}`);

export const releaseType = pgEnum("release_type", ["album", "ep", "single"]);
export const datePrecision = pgEnum("date_precision", ["year", "month", "day"]);

export const artists = pgTable(
  "artists",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    sortName: text("sort_name"),
    disambiguation: text("disambiguation"),
    country: varchar("country", { length: 2 }),
    /** "person", "group", "orchestra"… as given by the catalog provider. */
    type: text("type"),
    imageUrl: text("image_url"),
    mbid: uuid("mbid").unique(),
    /** Set once the discography has been imported (its releases may still be stubs). */
    discographyImportedAt: timestamp("discography_imported_at", { withTimezone: true }),
    /** Last time the nightly job re-read the discography for new releases. */
    discographyRefreshedAt: timestamp("discography_refreshed_at", { withTimezone: true }),
    mergedIntoId: mergedInto((): AnyPgColumn => artists.id),
    ...timestamps(),
  },
  (t) => [
    notMergedIntoItself("artists", t),
    index("artists_name_trgm_idx").using("gin", sql`${searchable(t.name)} gin_trgm_ops`),
    index("artists_name_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', immutable_unaccent(${t.name}))`,
    ),
  ],
);

export const releases = pgTable(
  "releases",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    type: releaseType("type").notNull(),
    /** MusicBrainz secondary types: "live", "compilation", "soundtrack", "remix"… */
    secondaryTypes: text("secondary_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    releaseDate: date("release_date"),
    releaseDatePrecision: datePrecision("release_date_precision"),
    coverUrl: text("cover_url"),
    /** Main language of the release (trends follow the members' language, not this one). */
    language: varchar("language", { length: 8 }),
    /** MusicBrainz release-group id. */
    mbid: uuid("mbid").unique(),
    /** MusicBrainz release chosen as the reference tracklist (rule in docs/catalogue.md). */
    referenceReleaseMbid: uuid("reference_release_mbid"),
    /**
     * Set once the tracklist, genres and cover are imported. Null = stub (known from an
     * artist's discography only), completed when its page is opened by a member.
     */
    tracklistImportedAt: timestamp("tracklist_imported_at", { withTimezone: true }),
    mergedIntoId: mergedInto((): AnyPgColumn => releases.id),
    ...timestamps(),
  },
  (t) => [
    notMergedIntoItself("releases", t),
    index("releases_title_trgm_idx").using("gin", sql`${searchable(t.title)} gin_trgm_ops`),
    index("releases_title_fts_idx").using(
      "gin",
      sql`to_tsvector('simple', immutable_unaccent(${t.title}))`,
    ),
    index("releases_release_date_idx").on(t.releaseDate),
  ],
);

export const tracks = pgTable(
  "tracks",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    durationMs: integer("duration_ms"),
    /** MusicBrainz recording id. */
    mbid: uuid("mbid").unique(),
    mergedIntoId: mergedInto((): AnyPgColumn => tracks.id),
    ...timestamps(),
  },
  (t) => [
    notMergedIntoItself("tracks", t),
    index("tracks_title_trgm_idx").using("gin", sql`${searchable(t.title)} gin_trgm_ops`),
  ],
);

export const releaseArtists = pgTable(
  "release_artists",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(1),
    creditName: text("credit_name"),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.artistId] }),
    index("release_artists_artist_idx").on(t.artistId),
  ],
);

export const releaseTracks = pgTable(
  "release_tracks",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict" }),
    disc: smallint("disc").notNull().default(1),
    position: smallint("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.disc, t.position] }),
    index("release_tracks_track_idx").on(t.trackId),
  ],
);

export const trackArtists = pgTable(
  "track_artists",
  {
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
    position: smallint("position").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.trackId, t.artistId] }),
    index("track_artists_artist_idx").on(t.artistId),
  ],
);

export const genres = pgTable("genres", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const releaseGenres = pgTable(
  "release_genres",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.releaseId, t.genreId] }),
    index("release_genres_genre_idx").on(t.genreId),
  ],
);
