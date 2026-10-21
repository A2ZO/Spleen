import { sql, type SQL } from "drizzle-orm";
import { check, smallint, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const id = () => uuid("id").primaryKey().defaultRandom();

/** CHECK expression: exactly one of the columns is not null. */
export const exactlyOne = (...columns: AnyPgColumn[]): SQL =>
  sql`num_nonnulls(${sql.join(columns, sql`, `)}) = 1`;

/** Ratings are 1..10 (half stars). */
export const rating = (name = "rating") => smallint(name);
export const ratingCheck = (table: string, column: AnyPgColumn) =>
  check(`${table}_rating_range`, sql`${column} between 1 and 10`);

/** Expression used by trigram and full-text indexes (accent- and case-insensitive). */
export const searchable = (column: AnyPgColumn) => sql`lower(immutable_unaccent(${column}))`;
