import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { createLocalStorage } from "@spleen/infra/storage";
import type { PickInput } from "@spleen/validators";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pickToListen, type PickViewer } from "./lib/listening/pick";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* « Tire un disque » (milestone 13, step 5), on an empty database. */

let handle: DbHandle;
// 23:30 UTC: already the 22nd in Paris, still the 21st in Los Angeles.
const now = new Date("2026-10-21T23:30:00Z");
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
const uploadsDir = mkdtempSync(path.join(tmpdir(), "spleen-pick-"));
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

async function member(options: { blindMode?: boolean; timeZone?: string } = {}) {
  const user = await account();
  await db()
    .insert(schema.profiles)
    .values({
      userId: user.id,
      username: user.username,
      displayName: `Name ${user.username}`,
      ageConfirmedAt: now,
      blindMode: options.blindMode ?? false,
      timeZone: options.timeZone ?? "Europe/Paris",
    });
  return user;
}

/** A record with one track per length given (seconds; null: a track without a length). */
async function record(
  seconds: (number | null)[] = [600],
  values: Partial<typeof schema.releases.$inferInsert> = {},
) {
  const slug = `record-${short()}`;
  const [row] = await db()
    .insert(schema.releases)
    .values({
      slug,
      title: `Record ${slug}`,
      type: "album",
      releaseDate: "2020-01-01",
      releaseDatePrecision: "day",
      ...values,
    })
    .returning();
  for (const [i, length] of seconds.entries()) {
    const [track] = await db()
      .insert(schema.tracks)
      .values({
        slug: `${slug}-${i}`,
        title: `Track ${i}`,
        durationMs: length === null ? null : length * 1000,
      })
      .returning();
    await db()
      .insert(schema.releaseTracks)
      .values({ releaseId: row!.id, trackId: track!.id, position: i + 1 });
  }
  return row!;
}

const queue = (who: Member, releaseId: string, rating?: number) =>
  db()
    .insert(schema.userItemState)
    .values({ userId: who.id, releaseId, wantToListen: true, rating });

const viewer = (who: Member, options: Partial<PickViewer> = {}): PickViewer => ({
  id: who.id,
  timeZone: "Europe/Paris",
  blind: false,
  ...options,
});

/** Every record the filters can draw: one draw per candidate with a stepped random value. */
async function drawable(who: Member, input: PickInput = {}, options: Partial<PickViewer> = {}) {
  const first = await pickToListen(db(), viewer(who, options), input, now, () => 0);
  const ids = new Set<string>();
  for (let i = 0; i < first.matching; i++) {
    const r = await pickToListen(db(), viewer(who, options), input, now, () => i / first.matching);
    if (r.pick) ids.add(r.pick.id);
  }
  return { ...first, ids };
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

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe("toListen.pick", () => {
  it("draws only my released, unmerged records, never a track", async () => {
    const me = await member();
    const other = await member();
    const mine = await record();
    const theirs = await record();
    const merged = await record([600], { mergedIntoId: mine.id });
    const [track] = await db()
      .insert(schema.tracks)
      .values({ slug: `t-${short()}`, title: "Single track" })
      .returning();
    await queue(me, mine.id);
    await queue(me, merged.id);
    await queue(other, theirs.id);
    await db()
      .insert(schema.userItemState)
      .values({ userId: me.id, trackId: track!.id, wantToListen: true });
    // Rated but not queued: not a candidate.
    const rated = await record();
    await db()
      .insert(schema.userItemState)
      .values({ userId: me.id, releaseId: rated.id, rating: 8 });

    const result = await drawable(me);
    expect(result).toMatchObject({ listTotal: 1, matching: 1 });
    expect([...result.ids]).toEqual([mine.id]);
  });

  it("leaves out a record not out yet in my zone", async () => {
    const paris = await member();
    const la = await member({ timeZone: "America/Los_Angeles" });
    const tomorrowInParis = await record([600], { releaseDate: "2026-10-22" });
    await queue(paris, tomorrowInParis.id);
    await queue(la, tomorrowInParis.id);

    expect((await drawable(paris, {}, { timeZone: "Europe/Paris" })).matching).toBe(1);
    const late = await drawable(la, {}, { timeZone: "America/Los_Angeles" });
    expect(late).toMatchObject({ listTotal: 1, matching: 0, pick: null });
    // Through the procedure: the zone comes from the profile.
    expect(await api(la).toListen.pick({})).toMatchObject({ listTotal: 1, matching: 0 });
    expect(await api(paris).toListen.pick({})).toMatchObject({ matching: 1 });
  });

  it("filters by type", async () => {
    const me = await member();
    const album = await record();
    const ep = await record([600], { type: "ep" });
    const single = await record([600], { type: "single" });
    for (const r of [album, ep, single]) await queue(me, r.id);

    expect([...(await drawable(me, { type: "album" })).ids]).toEqual([album.id]);
    expect([...(await drawable(me, { type: "ep" })).ids]).toEqual([ep.id]);
    expect([...(await drawable(me, { type: "single" })).ids]).toEqual([single.id]);
    expect((await drawable(me)).ids.size).toBe(3);
  });

  it("filters by length, 30 and 60 minutes included in « medium »", async () => {
    const me = await member();
    const under30 = await record([1000, 799]); // 29:59
    const at30 = await record([1800]); // 30:00
    const at60 = await record([1800, 1800]); // 60:00
    const over60 = await record([3601]); // 60:01
    const noTracks = await record([]);
    const missingLength = await record([1200, null]);
    for (const r of [under30, at30, at60, over60, noTracks, missingLength]) await queue(me, r.id);

    const short = await drawable(me, { duration: "short" });
    expect(short.matching).toBe(1);
    expect([...short.ids]).toEqual([under30.id]);
    expect([...(await drawable(me, { duration: "medium" })).ids].sort()).toEqual(
      [at30.id, at60.id].sort(),
    );
    expect([...(await drawable(me, { duration: "long" })).ids]).toEqual([over60.id]);
    // Unknown lengths are drawn without a length filter, shown without a length.
    const all = await drawable(me);
    expect(all.matching).toBe(6);
    const lengths = new Map<string, number | null>();
    for (let i = 0; i < 6; i++) {
      const r = await pickToListen(db(), viewer(me), {}, now, () => i / 6);
      lengths.set(r.pick!.id, r.pick!.durationMs);
    }
    expect(lengths.get(noTracks.id)).toBeNull();
    expect(lengths.get(missingLength.id)).toBeNull();
    expect(lengths.get(under30.id)).toBe(1_799_000);
    expect(lengths.get(at60.id)).toBe(3_600_000);
  });

  it("draws another record than `not`, unless it is the only one", async () => {
    const me = await member();
    const a = await record();
    const b = await record();
    await queue(me, a.id);
    await queue(me, b.id);
    for (const value of [0, 0.5, 0.999]) {
      const r = await pickToListen(db(), viewer(me), { not: a.id }, now, () => value);
      expect(r).toMatchObject({ matching: 2 });
      expect(r.pick?.id).toBe(b.id);
    }
    const onlyEp = await record([600], { type: "ep" });
    await queue(me, onlyEp.id);
    const alone = await pickToListen(db(), viewer(me), { type: "ep", not: onlyEp.id }, now);
    expect(alone).toMatchObject({ matching: 1, pick: { id: onlyEp.id } });
  });

  it("uses the injected random value, uniformly over the candidates", async () => {
    const me = await member();
    for (let i = 0; i < 4; i++) await queue(me, (await record()).id);
    const drawn = await Promise.all(
      [0, 0.25, 0.5, 0.75, 0.9999, 1].map(
        async (v) => (await pickToListen(db(), viewer(me), {}, now, () => v)).pick!.id,
      ),
    );
    expect(new Set(drawn.slice(0, 4)).size).toBe(4);
    // 1 (never returned by Math.random) still lands on the last candidate.
    expect(drawn[5]).toBe(drawn[4]);
  });

  it("answers the three empty cases", async () => {
    const empty = await member();
    expect(await api(empty).toListen.pick({})).toEqual({ listTotal: 0, matching: 0, pick: null });

    const waiting = await member();
    await queue(waiting, (await record([600], { releaseDate: "2027-03-01" })).id);
    expect(await api(waiting).toListen.pick({})).toEqual({
      listTotal: 1,
      matching: 0,
      pick: null,
    });

    const filtered = await member();
    await queue(filtered, (await record()).id);
    expect(await api(filtered).toListen.pick({ type: "single" })).toEqual({
      listTotal: 1,
      matching: 0,
      pick: null,
    });
  });

  it("returns the card with its length and its five listen links", async () => {
    const me = await member();
    const r = await record([600, 900]);
    await db().insert(schema.listenLinks).values({
      releaseId: r.id,
      service: "deezer",
      url: "https://www.deezer.com/album/302127",
    });
    await queue(me, r.id);
    const { pick } = await api(me).toListen.pick({});
    expect(pick).toMatchObject({ id: r.id, slug: r.slug, durationMs: 1_500_000, year: 2020 });
    expect(pick!.listenLinks.map((l) => [l.service, l.direct])).toEqual([
      ["spotify", false],
      ["deezer", true],
      ["appleMusic", false],
      ["youtubeMusic", false],
      ["bandcamp", false],
    ]);
  });

  it("hides the community rating in blind listening until I have rated the record", async () => {
    const me = await member({ blindMode: true });
    const fan = await member();
    const r = await record();
    await db().insert(schema.userItemState).values({ userId: fan.id, releaseId: r.id, rating: 9 });
    await queue(me, r.id);
    expect((await api(me).toListen.pick({})).pick).toMatchObject({
      averageRating: null,
      ratingsHidden: true,
    });
    await db()
      .update(schema.userItemState)
      .set({ rating: 6 })
      .where(eq(schema.userItemState.userId, me.id));
    expect((await api(me).toListen.pick({})).pick).toMatchObject({ averageRating: 7.5 });
    // Without blind listening, the rating shows at once.
    const open = await member();
    await queue(open, r.id);
    expect((await api(open).toListen.pick({})).pick).toMatchObject({ averageRating: 7.5 });
  });

  it("refuses visitors, suspended accounts and members without a profile", async () => {
    expect(await errorCode(() => api(null).toListen.pick({}))).toBe("UNAUTHENTICATED");
    const suspended = await member();
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now, suspensionReason: "Spam" })
      .where(eq(schema.profiles.userId, suspended.id));
    expect(await errorCode(() => api(suspended).toListen.pick({}))).toBe("ACCOUNT_SUSPENDED");
    const noProfile = await account();
    expect(await errorCode(() => api(noProfile).toListen.pick({}))).toBe("PROFILE_REQUIRED");
  });
});
