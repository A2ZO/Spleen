import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { createdAt, id, timestamps } from "./_shared";

/*
 * Better Auth core tables (user, session, account, verification), with UUID ids.
 * Social providers (Google now, Apple later) are just rows in `account`: adding one needs
 * no migration. Field names follow Better Auth's core schema; milestone 3 checks them
 * against the version installed and adjusts if needed.
 */

export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...timestamps(),
});

export const session = pgTable(
  "session",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps(),
  },
  (t) => [
    index("account_user_idx").on(t.userId),
    uniqueIndex("account_provider_account_uidx").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* Spleen profile, 1:1 with `user`. */

export const userRole = pgEnum("user_role", ["member", "admin"]);
export const themePreference = pgEnum("theme_preference", ["dark", "light"]);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    locale: varchar("locale", { length: 8 }).notNull().default("fr"),
    theme: themePreference("theme").notNull().default("dark"),
    /** IANA time zone: "today" for a new listen is computed in it, never in the server's. */
    timeZone: text("time_zone").notNull().default("Europe/Paris"),
    statsPrivate: boolean("stats_private").notNull().default(false),
    diaryPrivate: boolean("diary_private").notNull().default(false),
    /** Hide community averages until the member has rated ("blind listening"). */
    blindMode: boolean("blind_mode").notNull().default(false),
    role: userRole("role").notNull().default("member"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    /** Set when the member confirms being 15 or older at sign-up. */
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("profiles_username_lower_uidx").on(sql`lower(${t.username})`)],
);

/*
 * Former usernames. A row keeps `username` reserved for 30 days after `changed_at` (except
 * for its former owner), throttles renames to one per 30 days, and will back redirects
 * later. On account deletion the current username gets a row too and `user_id` becomes
 * NULL: the names stay reserved without any link to the person, then are purged.
 */
export const usernameHistory = pgTable(
  "username_history",
  {
    id: id(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    username: text("username").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("username_history_username_idx").on(sql`lower(${t.username})`, t.changedAt),
    index("username_history_user_idx").on(t.userId, t.changedAt),
  ],
);

/* Spleen+ (empty until monetisation), store-agnostic. */

export const subscriptionPlatform = pgEnum("subscription_platform", ["stripe", "apple", "google"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: subscriptionPlatform("platform").notNull(),
    status: subscriptionStatus("status").notNull(),
    externalId: text("external_id").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId),
    uniqueIndex("subscriptions_platform_external_uidx").on(t.platform, t.externalId),
  ],
);

/* Push notification tokens for the future Expo app. */

export const pushPlatform = pgEnum("push_platform", ["ios", "android", "web"]);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: pushPlatform("platform").notNull(),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);
