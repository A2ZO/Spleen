import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { and, eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { createLocalStorage } from "@spleen/infra/storage";
import { ARTIST_FOLLOWS_MAX } from "@spleen/validators";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* Following artists (milestone 11, step 1), on an empty database. */

let handle: DbHandle;
const now = new Date("2026-11-16T12:00:00Z");
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
const uploadsDir = mkdtempSync(path.join(tmpdir(), "spleen-artist-follows-"));
const storage = () => createLocalStorage({ dir: uploadsDir });
const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user, storage }));

let admin: SessionUser;

async function account(): Promise<SessionUser & { username: string }> {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  return { id: row!.id, email: row!.email, username };
}

async function member(role: "member" | "admin" = "member") {
  const user = await account();
  await db().insert(schema.profiles).values({
    userId: user.id,
    username: user.username,
    displayName: user.username,
    role,
    ageConfirmedAt: now,
  });
  return user;
}

async function artist(name = `Artist ${short()}`) {
  const [row] = await db()
    .insert(schema.artists)
    .values({ slug: `artist-${short()}`, name })
    .returning();
  return row!;
}

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof TRPCError) return error.message;
    throw error;
  }
  throw new Error("expected an error");
}

const followRows = (userId: string) =>
  db().select().from(schema.artistFollows).where(eq(schema.artistFollows.userId, userId));

beforeAll(async () => {
  handle = await createTestDb();
  admin = await member("admin");
}, 60_000);

afterAll(async () => {
  await handle.close();
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe("following an artist", () => {
  it("follows, reads the status and the list, unfollows; following twice is harmless", async () => {
    const m = await member();
    const [b, a] = [await artist("Beta"), await artist("Alpha")];
    expect(await api(m).artistFollow.status({ artistId: a.id })).toEqual({ following: false });
    await api(m).artistFollow.follow({ artistId: b.id });
    await api(m).artistFollow.follow({ artistId: a.id });
    await api(m).artistFollow.follow({ artistId: a.id });
    expect(await followRows(m.id)).toHaveLength(2);
    expect(await api(m).artistFollow.status({ artistId: a.id })).toEqual({ following: true });
    const mine = await api(m).artistFollow.mine();
    expect(mine.map((r) => r.name)).toEqual(["Alpha", "Beta"]);
    expect(mine[0]).toMatchObject({ id: a.id, slug: a.slug, followedAt: now.toISOString() });

    await api(m).artistFollow.unfollow({ artistId: a.id });
    await api(m).artistFollow.unfollow({ artistId: a.id });
    expect(await api(m).artistFollow.status({ artistId: a.id })).toEqual({ following: false });
    expect((await api(m).artistFollow.mine()).map((r) => r.id)).toEqual([b.id]);
  });

  it("follows the page kept when given a merged duplicate; refuses an unknown artist", async () => {
    const m = await member();
    const [keep, dup] = [await artist(), await artist()];
    await db()
      .update(schema.artists)
      .set({ mergedIntoId: keep.id })
      .where(eq(schema.artists.id, dup.id));
    await api(m).artistFollow.follow({ artistId: dup.id });
    expect((await followRows(m.id)).map((r) => r.artistId)).toEqual([keep.id]);
    expect(await api(m).artistFollow.status({ artistId: dup.id })).toEqual({ following: true });
    expect(await errorCode(() => api(m).artistFollow.follow({ artistId: randomUUID() }))).toBe(
      "ITEM_NOT_FOUND",
    );
  });

  it(`stops at ${ARTIST_FOLLOWS_MAX} artists with a dedicated code`, async () => {
    const m = await member();
    const many = await db()
      .insert(schema.artists)
      .values(
        Array.from({ length: ARTIST_FOLLOWS_MAX }, (_, i) => ({
          slug: `many-${short()}-${i}`,
          name: `Many ${i}`,
        })),
      )
      .returning({ id: schema.artists.id });
    await db()
      .insert(schema.artistFollows)
      .values(many.map((a) => ({ userId: m.id, artistId: a.id })));
    const extra = await artist();
    expect(await errorCode(() => api(m).artistFollow.follow({ artistId: extra.id }))).toBe(
      "ARTIST_FOLLOW_LIMIT",
    );
    // Following one already followed still answers without error.
    await api(m).artistFollow.follow({ artistId: many[0]!.id });
    expect((await api(m).artistFollow.mine()).length).toBe(ARTIST_FOLLOWS_MAX);
  });

  it("spends the hourly write limit (200 per hour)", async () => {
    const m = await member();
    const a = await artist();
    await db()
      .insert(schema.rateLimits)
      .values({ key: `artist-follow-write:${m.id}`, count: 200, windowStart: new Date() });
    expect(await errorCode(() => api(m).artistFollow.follow({ artistId: a.id }))).toBe(
      "RATE_LIMITED",
    );
    expect(await errorCode(() => api(m).artistFollow.unfollow({ artistId: a.id }))).toBe(
      "RATE_LIMITED",
    );
  });

  it("refuses visitors, suspended accounts and members without a profile", async () => {
    const a = await artist();
    expect(await errorCode(() => api(null).artistFollow.follow({ artistId: a.id }))).toBe(
      "UNAUTHENTICATED",
    );
    expect(await errorCode(() => api(null).artistFollow.mine())).toBe("UNAUTHENTICATED");

    const suspended = await member();
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now, suspensionReason: "Spam" })
      .where(eq(schema.profiles.userId, suspended.id));
    expect(await errorCode(() => api(suspended).artistFollow.follow({ artistId: a.id }))).toBe(
      "ACCOUNT_SUSPENDED",
    );

    const fresh = await account();
    expect(await errorCode(() => api(fresh).artistFollow.follow({ artistId: a.id }))).toBe(
      "PROFILE_REQUIRED",
    );
    expect(await errorCode(() => api(fresh).artistFollow.status({ artistId: a.id }))).toBe(
      "PROFILE_REQUIRED",
    );
    expect(await errorCode(() => api(fresh).account.setNotifyReleases({ enabled: false }))).toBe(
      "PROFILE_REQUIRED",
    );
  });

  it("keeps the list private: nothing in the public profile", async () => {
    const m = await member();
    const a = await artist("Secret Artist");
    await api(m).artistFollow.follow({ artistId: a.id });
    const profile = await api(await member()).profile.byUsername({ username: m.username });
    expect(profile).not.toBeNull();
    expect(JSON.stringify(profile)).not.toContain(a.id);
    expect(JSON.stringify(profile)).not.toContain("Secret Artist");
  });
});

describe("artist merges and account data", () => {
  it("moves follows to the page kept, one row for a member who followed both", async () => {
    const [one, both] = [await member(), await member()];
    const [keep, dup] = [await artist(), await artist()];
    await api(one).artistFollow.follow({ artistId: dup.id });
    await api(both).artistFollow.follow({ artistId: dup.id });
    await api(both).artistFollow.follow({ artistId: keep.id });
    await api(admin).admin.merge({
      kind: "artist",
      keep: keep.slug,
      duplicate: dup.slug,
      reason: "Même artiste importé deux fois",
    });
    expect((await followRows(one.id)).map((r) => r.artistId)).toEqual([keep.id]);
    expect((await followRows(both.id)).map((r) => r.artistId)).toEqual([keep.id]);
    expect(await db().$count(schema.artistFollows, eq(schema.artistFollows.artistId, dup.id))).toBe(
      0,
    );
  });

  it("exports follows and the notification setting; deleting the account erases them", async () => {
    const m = await member();
    const a = await artist("Exported");
    await api(m).artistFollow.follow({ artistId: a.id });
    expect((await api(m).account.me())?.profile?.notifyReleases).toBe(true);
    await api(m).account.setNotifyReleases({ enabled: false });
    expect((await api(m).account.me())?.profile?.notifyReleases).toBe(false);

    const exported = await api(m).account.export();
    expect(exported.artistFollows).toEqual([
      { artistId: a.id, slug: a.slug, name: "Exported", followedAt: now },
    ]);
    expect((exported.profile as { notifyReleases: boolean }).notifyReleases).toBe(false);

    await api(m).account.delete({ confirmUsername: m.username });
    expect(
      await db().$count(
        schema.artistFollows,
        and(eq(schema.artistFollows.userId, m.id), eq(schema.artistFollows.artistId, a.id)),
      ),
    ).toBe(0);
  });
});
