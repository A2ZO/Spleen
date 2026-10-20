import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { id, timestamps } from "./_shared";
import { user } from "./auth";

export const importKind = pgEnum("import_kind", ["release_group", "artist", "recording"]);
export const importStatus = pgEnum("import_status", ["pending", "running", "done", "failed"]);

/** Single MusicBrainz import queue (milestone 4). One job per MusicBrainz entity. */
export const catalogImportJobs = pgTable(
  "catalog_import_jobs",
  {
    id: id(),
    kind: importKind("kind").notNull(),
    mbid: uuid("mbid").notNull(),
    status: importStatus("status").notNull().default("pending"),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    requestedById: uuid("requested_by_id").references(() => user.id, { onDelete: "set null" }),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [
    unique("catalog_import_jobs_kind_mbid_unique").on(t.kind, t.mbid),
    index("catalog_import_jobs_status_run_idx").on(t.status, t.runAfter),
  ],
);

/**
 * Rate limiter state kept in Postgres (works without a long-running server).
 * Fixed windows for user-facing limits; `next_allowed_at` serves as the global
 * MusicBrainz 1 req/s gate.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
  nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true }),
});

/** Per-member base stats cache; the row is deleted when the member adds or edits a listen. */
export const userStatsCache = pgTable("user_stats_cache", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});
