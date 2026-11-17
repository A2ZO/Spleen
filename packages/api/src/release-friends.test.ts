import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { and, eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { createLocalStorage } from "@spleen/infra/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* « Tes amis sur ce disque » (milestone 13, step 4), on an empty database. */

let handle: DbHandle;
const now = new Date("2026-11-17T12:00:00Z");
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
const uploadsDir = mkdtempSync(path.join(tmpdir(), "spleen-release-friends-"));
const storage = () => createLocalStorage({ dir: uploadsDir });
const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user, storage }));

type Member = SessionUser & { username: string };

async function account(): Promise<Member> {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  return { id: row!.id, email: row!.email, username };
}

async function member(
  options: {
    username?: string;
    diaryPrivate?: boolean;
    blindMode?: boolean;
    timeZone?: string;
  } = {},
): Promise<Member> {
  const user = await account();
  const username = options.username ?? user.username;
  await db()
    .insert(schema.profiles)
    .values({
      userId: user.id,
      username,
      displayName: `Name ${username}`,
      ageConfirmedAt: now,
      diaryPrivate: options.diaryPrivate ?? false,
      blindMode: options.blindMode ?? false,
      timeZone: options.timeZone ?? "Europe/Paris",
    });
  return { ...user, username };
}

async function release(values: Partial<typeof schema.releases.$inferInsert> = {}) {
  const [row] = await db()
    .insert(schema.releases)
    .values({
      slug: `record-${short()}`,
      title: "Record",
      type: "album",
      releaseDate: "2020-01-01",
      releaseDatePrecision: "day",
      ...values,
    })
    .returning();
  return row!;
}

const follow = (follower: Member, followee: Member) =>
  db().insert(schema.follows).values({ followerId: follower.id, followeeId: followee.id });

async function opinion(
  who: Member,
  releaseId: string,
  state: Partial<typeof schema.userItemState.$inferInsert>,
  updatedAt = now,
) {
  await db()
    .insert(schema.userItemState)
    .values({ userId: who.id, releaseId, ...state });
  // Set apart: `updated_at` follows the wall clock on every write.
  await db()
    .update(schema.userItemState)
    .set({ updatedAt })
    .where(
      and(eq(schema.userItemState.userId, who.id), eq(schema.userItemState.releaseId, releaseId)),
    );
}

const friends = (who: SessionUser | null, slug: string, all?: boolean) =>
  api(who).release.friends({ slug, all });
const names = (result: Awaited<ReturnType<typeof friends>>) =>
  result?.items.map((i) => i.member.username);

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe("release.friends", () => {
  it("lists followed members with a rating or a heart, not a bare listen or « À écouter »", async () => {
    const me = await member();
    const r = await release();
    const [rated, liked, listened, wanted, stranger] = await Promise.all(
      Array.from({ length: 5 }, () => member()),
    );
    for (const m of [rated!, liked!, listened!, wanted!]) await follow(me, m);
    await opinion(rated!, r.id, { rating: 7, listened: true }, new Date("2026-11-10"));
    await opinion(liked!, r.id, { liked: true }, new Date("2026-11-11"));
    await opinion(listened!, r.id, { listened: true });
    await opinion(wanted!, r.id, { wantToListen: true });
    await opinion(stranger!, r.id, { rating: 9 });
    await opinion(me, r.id, { rating: 3 });

    const result = await friends(me, r.slug);
    expect(result).toEqual({
      items: [
        {
          member: {
            username: liked!.username,
            displayName: `Name ${liked!.username}`,
            avatarUrl: null,
          },
          rating: null,
          liked: true,
        },
        {
          member: {
            username: rated!.username,
            displayName: `Name ${rated!.username}`,
            avatarUrl: null,
          },
          rating: 7,
          liked: false,
        },
      ],
      total: 2,
    });
  });

  it("leaves out blocks either way, suspended members and private diaries", async () => {
    const me = await member();
    const r = await release();
    const [kept, blockedByMe, blockingMe, suspended, secret] = await Promise.all(
      Array.from({ length: 4 }, () => member()).concat(member({ diaryPrivate: true })),
    );
    for (const m of [kept!, blockedByMe!, blockingMe!, suspended!, secret!]) {
      await follow(me, m);
      await opinion(m, r.id, { rating: 8 });
    }
    await db()
      .insert(schema.blocks)
      .values([
        { blockerId: me.id, blockedId: blockedByMe!.id },
        { blockerId: blockingMe!.id, blockedId: me.id },
      ]);
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now, suspensionReason: "Spam" })
      .where(eq(schema.profiles.userId, suspended!.id));
    const result = await friends(me, r.slug);
    expect(names(result)).toEqual([kept!.username]);
    expect(result?.total).toBe(1);
  });

  it("answers null to a visitor, a suspended account, one without a profile, and with no friend", async () => {
    const r = await release();
    const friend = await member();
    await opinion(friend, r.id, { rating: 8 });
    const [suspended, noProfile, lonely] = [await member(), await account(), await member()];
    await follow(suspended, friend);
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now, suspensionReason: "Spam" })
      .where(eq(schema.profiles.userId, suspended.id));
    expect(await friends(null, r.slug)).toBeNull();
    expect(await friends(null, r.slug, true)).toBeNull();
    expect(await friends(suspended, r.slug)).toBeNull();
    expect(await friends(noProfile, r.slug)).toBeNull();
    expect(await friends(lonely, r.slug)).toBeNull();
  });

  it("answers null on a record not out yet in the viewer's zone", async () => {
    // 2026-11-17T12:00Z is already the 18th in Kiritimati (UTC+14), still the 17th in Paris.
    const r = await release({ releaseDate: "2026-11-18" });
    const friend = await member();
    await opinion(friend, r.id, { liked: true });
    const [paris, kiritimati] = [await member(), await member({ timeZone: "Pacific/Kiritimati" })];
    await follow(paris, friend);
    await follow(kiritimati, friend);
    expect(await friends(paris, r.slug)).toBeNull();
    expect(names(await friends(kiritimati, r.slug))).toEqual([friend.username]);
  });

  it("in blind listening, shows nothing until the viewer has rated the record", async () => {
    const r = await release();
    const [me, friend] = [await member({ blindMode: true }), await member()];
    await follow(me, friend);
    await opinion(friend, r.id, { rating: 6 });
    await opinion(me, r.id, { liked: true, listened: true });
    expect(await friends(me, r.slug)).toBeNull();
    await db()
      .update(schema.userItemState)
      .set({ rating: 9 })
      .where(and(eq(schema.userItemState.userId, me.id), eq(schema.userItemState.releaseId, r.id)));
    expect(names(await friends(me, r.slug))).toEqual([friend.username]);
  });

  it("sorts by latest change then username; 5 rows and the total, 100 with `all`", async () => {
    const me = await member();
    const r = await release();
    const tag = short();
    const many = await Promise.all(
      Array.from({ length: 103 }, (_, i) =>
        member({ username: `f${tag}${String(i).padStart(3, "0")}` }),
      ),
    );
    for (const [i, m] of many.entries()) {
      await follow(me, m);
      // Two by two on the same date: the username decides between them.
      await opinion(m, r.id, { rating: 6 }, new Date(Date.UTC(2026, 0, 1, 0, Math.floor(i / 2))));
    }
    const shown = await friends(me, r.slug);
    expect(shown?.total).toBe(103);
    expect(names(shown)).toEqual(
      [102, 100, 101, 98, 99].map((i) => `f${tag}${String(i).padStart(3, "0")}`),
    );
    const all = await friends(me, r.slug, true);
    expect(all?.total).toBe(103);
    expect(all?.items).toHaveLength(100);
  });

  it("answers null for an unknown or merged slug", async () => {
    const me = await member();
    const [kept, dup] = [await release(), await release()];
    await db()
      .update(schema.releases)
      .set({ mergedIntoId: kept.id })
      .where(eq(schema.releases.id, dup.id));
    const friend = await member();
    await follow(me, friend);
    await opinion(friend, dup.id, { rating: 8 });
    expect(await friends(me, dup.slug)).toBeNull();
    expect(await friends(me, `nothing-${short()}`)).toBeNull();
  });
});
