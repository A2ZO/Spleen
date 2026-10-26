import { randomUUID } from "node:crypto";

import { eq, freesUsernamesAtOnce, inArray, or, schema, type Db } from "@spleen/db";
import type { Storage } from "@spleen/infra/storage";
import {
  AVATAR_MAX_BYTES,
  usernameSchema,
  type OnboardingInput,
  type ProfileUpdateInput,
} from "@spleen/validators";

import { fail, type SessionUser } from "../trpc";
import type { AccountExport, Me, MyProfile } from "../types";
import {
  nextRenameAt,
  purgeExpiredAnonymousReservations,
  usernameStatus,
  type UsernameStatus,
} from "./usernames";

const p = schema.profiles;

/** Postgres unique violation, through Drizzle's error wrapper. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function failForStatus(status: Exclude<UsernameStatus, "available">): never {
  if (status === "invalid") fail("BAD_REQUEST", "USERNAME_INVALID");
  if (status === "reserved") fail("CONFLICT", "USERNAME_RESERVED");
  fail("CONFLICT", "USERNAME_TAKEN");
}

async function findProfile(db: Db, userId: string) {
  const [row] = await db.select().from(p).where(eq(p.userId, userId)).limit(1);
  return row ?? null;
}

async function requireProfile(db: Db, userId: string) {
  const row = await findProfile(db, userId);
  if (!row) fail("PRECONDITION_FAILED", "PROFILE_REQUIRED");
  return row;
}

export async function getMe(db: Db, user: SessionUser, now: Date): Promise<Me> {
  const row = await findProfile(db, user.id);
  let profile: MyProfile | null = null;
  if (row) {
    const renameAt = await nextRenameAt(db, user.id, now);
    profile = {
      username: row.username,
      displayName: row.displayName,
      bio: row.bio,
      avatarUrl: row.avatarUrl,
      locale: row.locale === "en" ? "en" : "fr",
      theme: row.theme,
      statsPrivate: row.statsPrivate,
      diaryPrivate: row.diaryPrivate,
      blindMode: row.blindMode,
      timeZone: row.timeZone,
      usernameChangeAvailableAt: renameAt?.toISOString() ?? null,
    };
  }
  return { userId: user.id, email: user.email, profile };
}

export async function onboard(
  db: Db,
  user: SessionUser,
  input: OnboardingInput,
  now: Date,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      if (await findProfile(tx, user.id)) fail("CONFLICT", "PROFILE_EXISTS");
      await purgeExpiredAnonymousReservations(tx, now);
      const status = await usernameStatus(tx, input.username, user.id, now);
      if (status !== "available") failForStatus(status);
      await tx.insert(p).values({
        userId: user.id,
        username: input.username,
        displayName: input.displayName,
        locale: input.locale,
        theme: input.theme,
        ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        ageConfirmedAt: now,
      });
      await tx
        .update(schema.user)
        .set({ name: input.displayName })
        .where(eq(schema.user.id, user.id));
    });
  } catch (error) {
    // Two members claiming the same username at once: the unique index decides.
    if (isUniqueViolation(error)) fail("CONFLICT", "USERNAME_TAKEN");
    throw error;
  }
}

export async function updateProfile(
  db: Db,
  user: SessionUser,
  input: ProfileUpdateInput,
): Promise<void> {
  await requireProfile(db, user.id);
  await db.update(p).set(input).where(eq(p.userId, user.id));
  await db.update(schema.user).set({ name: input.displayName }).where(eq(schema.user.id, user.id));
}

export async function changeUsername(
  db: Db,
  user: SessionUser,
  raw: string,
  now: Date,
): Promise<void> {
  const username = usernameSchema.parse(raw);
  try {
    await db.transaction(async (tx) => {
      const profile = await requireProfile(tx, user.id);
      if (profile.username === username) fail("BAD_REQUEST", "USERNAME_UNCHANGED");
      if (await nextRenameAt(tx, user.id, now)) fail("TOO_MANY_REQUESTS", "USERNAME_COOLDOWN");
      await purgeExpiredAnonymousReservations(tx, now);
      const status = await usernameStatus(tx, username, user.id, now);
      if (status !== "available") failForStatus(status);
      await tx
        .insert(schema.usernameHistory)
        .values({ userId: user.id, username: profile.username, changedAt: now });
      await tx.update(p).set({ username }).where(eq(p.userId, user.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) fail("CONFLICT", "USERNAME_TAKEN");
    throw error;
  }
}

/* Avatars ------------------------------------------------------------------------------ */

const startsWith = (data: Uint8Array, bytes: number[], offset = 0) =>
  bytes.every((b, i) => data[offset + i] === b);

/** Image type from the file's magic bytes (never trust the declared type). */
export function sniffImageType(data: Uint8Array): { contentType: string; ext: string } | null {
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { contentType: "image/webp", ext: "webp" };
  }
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", ext: "png" };
  }
  if (startsWith(data, [0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", ext: "jpg" };
  return null;
}

/** Best-effort removal of a file we stored; failures only leave an orphan file behind. */
async function deleteStoredFile(storage: Storage, url: string | null): Promise<void> {
  const key = url ? storage.keyFromUrl(url) : null;
  if (!key) return;
  await storage.delete(key).catch(() => {
    console.warn("[spleen] could not delete a stored file (left as an orphan).");
  });
}

export async function setAvatar(
  db: Db,
  storage: Storage,
  user: SessionUser,
  data: Uint8Array,
): Promise<{ avatarUrl: string }> {
  if (data.byteLength > AVATAR_MAX_BYTES) fail("PAYLOAD_TOO_LARGE", "AVATAR_TOO_LARGE");
  const type = sniffImageType(data);
  if (!type) fail("BAD_REQUEST", "AVATAR_TYPE");
  const profile = await requireProfile(db, user.id);

  // A fresh key per upload: URLs are cached forever and never point to another image.
  const key = `avatars/${user.id}/${randomUUID()}.${type.ext}`;
  await storage.put(key, data, type.contentType);
  const avatarUrl = storage.publicUrl(key);
  await db.update(p).set({ avatarUrl }).where(eq(p.userId, user.id));
  await deleteStoredFile(storage, profile.avatarUrl);
  return { avatarUrl };
}

export async function removeAvatar(db: Db, storage: Storage, user: SessionUser): Promise<void> {
  const profile = await requireProfile(db, user.id);
  await db.update(p).set({ avatarUrl: null }).where(eq(p.userId, user.id));
  await deleteStoredFile(storage, profile.avatarUrl);
}

/* Export and deletion ------------------------------------------------------------------ */

/** Everything Spleen stores about the member (GDPR access/portability), as plain JSON. */
export async function exportAccount(db: Db, user: SessionUser, now: Date): Promise<AccountExport> {
  const s = schema;
  const uid = user.id;
  const [account] = await db
    .select({
      id: s.user.id,
      email: s.user.email,
      emailVerified: s.user.emailVerified,
      createdAt: s.user.createdAt,
    })
    .from(s.user)
    .where(eq(s.user.id, uid));

  const entries = await db.select().from(s.entries).where(eq(s.entries.userId, uid));
  const entryIds = entries.map((e) => e.id);
  const lists = await db.select().from(s.lists).where(eq(s.lists.userId, uid));
  const listIds = lists.map((l) => l.id);

  const [
    profile,
    usernameHistory,
    signInMethods,
    sessions,
    entryMoods,
    moods,
    trackRatings,
    itemStates,
    reviews,
    listItems,
    favorites,
    follows,
    likes,
    comments,
    notifications,
    blocks,
    reports,
    subscriptions,
  ] = await Promise.all([
    db.select().from(s.profiles).where(eq(s.profiles.userId, uid)),
    db
      .select({ username: s.usernameHistory.username, changedAt: s.usernameHistory.changedAt })
      .from(s.usernameHistory)
      .where(eq(s.usernameHistory.userId, uid)),
    // Provider names only: tokens and secrets never leave the database.
    db
      .select({ provider: s.account.providerId, createdAt: s.account.createdAt })
      .from(s.account)
      .where(eq(s.account.userId, uid)),
    db
      .select({
        createdAt: s.session.createdAt,
        expiresAt: s.session.expiresAt,
        ipAddress: s.session.ipAddress,
        userAgent: s.session.userAgent,
      })
      .from(s.session)
      .where(eq(s.session.userId, uid)),
    entryIds.length
      ? db.select().from(s.entryMoods).where(inArray(s.entryMoods.entryId, entryIds))
      : [],
    db.select().from(s.moods).where(eq(s.moods.ownerId, uid)),
    entryIds.length
      ? db.select().from(s.trackRatings).where(inArray(s.trackRatings.entryId, entryIds))
      : [],
    db.select().from(s.userItemState).where(eq(s.userItemState.userId, uid)),
    db.select().from(s.reviews).where(eq(s.reviews.userId, uid)),
    listIds.length ? db.select().from(s.listItems).where(inArray(s.listItems.listId, listIds)) : [],
    db.select().from(s.favorites).where(eq(s.favorites.userId, uid)),
    db
      .select()
      .from(s.follows)
      .where(or(eq(s.follows.followerId, uid), eq(s.follows.followeeId, uid))),
    db.select().from(s.likes).where(eq(s.likes.userId, uid)),
    db.select().from(s.comments).where(eq(s.comments.userId, uid)),
    db.select().from(s.notifications).where(eq(s.notifications.userId, uid)),
    db.select().from(s.blocks).where(eq(s.blocks.blockerId, uid)),
    db.select().from(s.reports).where(eq(s.reports.reporterId, uid)),
    db.select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)),
  ]);

  return {
    format: "spleen-export/1",
    exportedAt: now.toISOString(),
    account: account ?? null,
    profile: profile[0] ?? null,
    usernameHistory,
    signInMethods,
    sessions,
    entries,
    entryMoods,
    moods,
    trackRatings,
    itemStates,
    reviews,
    lists,
    listItems,
    favorites,
    follows,
    likes,
    comments,
    notifications,
    blocks,
    reports,
    subscriptions,
  };
}

/**
 * Deletes the account and, by cascade, all member data. The current and former usernames
 * stay reserved for 30 days through `username_history` rows whose `user_id` becomes NULL,
 * except for e2e test accounts in development and tests (`freesUsernamesAtOnce`).
 */
export async function deleteAccount(
  db: Db,
  storage: Storage,
  user: SessionUser,
  confirmUsername: string,
  now: Date,
): Promise<void> {
  const profile = await findProfile(db, user.id);
  if (profile && profile.username !== confirmUsername.trim().toLowerCase()) {
    fail("BAD_REQUEST", "CONFIRMATION_MISMATCH");
  }
  if (!profile && confirmUsername.trim().toLowerCase() !== user.email.toLowerCase()) {
    fail("BAD_REQUEST", "CONFIRMATION_MISMATCH");
  }
  await db.transaction(async (tx) => {
    if (profile && !freesUsernamesAtOnce(user.email)) {
      await tx
        .insert(schema.usernameHistory)
        .values({ userId: user.id, username: profile.username, changedAt: now });
    }
    await tx.delete(schema.user).where(eq(schema.user.id, user.id));
  });
  if (profile) await deleteStoredFile(storage, profile.avatarUrl);
}
