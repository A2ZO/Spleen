import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, rowsOf, schema, sql, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { createLocalStorage } from "@spleen/infra/storage";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  isRoundAnniversary,
  MEMORIES_ANNIVERSARIES_MAX,
  MEMORIES_LISTENS_MAX,
  roundAnniversarySql,
  sameDayInPastYears,
} from "./lib/memories";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* « Souvenirs » of the home page (milestone 14, step 2), on an empty database. */

let handle: DbHandle;
const now = new Date("2026-11-17T12:00:00Z");
// 23:30 UTC: already the 18th in Paris, still the 17th in Los Angeles.
const midnight = new Date("2026-11-17T23:30:00Z");
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
const uploadsDir = mkdtempSync(path.join(tmpdir(), "spleen-memories-"));
const storage = () => createLocalStorage({ dir: uploadsDir });
const api = (user: SessionUser | null, at = now) =>
  createCaller(createContext({ now: at, db: () => handle.db, user: async () => user, storage }));

type Member = SessionUser & { username: string };

async function account(): Promise<Member> {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  return { id: row!.id, email: row!.email, username };
}

async function member(timeZone = "Europe/Paris") {
  const user = await account();
  await db()
    .insert(schema.profiles)
    .values({
      userId: user.id,
      username: user.username,
      displayName: `Name ${user.username}`,
      ageConfirmedAt: now,
      timeZone,
    });
  return user;
}

async function record(values: Partial<typeof schema.releases.$inferInsert> = {}) {
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
  return row!;
}

/** A dated listen (`createdAt` orders the tiles). */
const listen = (who: Member, releaseId: string, listenedOn: string | null, createdAt = now) =>
  db()
    .insert(schema.entries)
    .values({ userId: who.id, releaseId, listenedOn, createdAt, updatedAt: createdAt });

const state = (
  who: Member,
  releaseId: string,
  values: Partial<typeof schema.userItemState.$inferInsert>,
) =>
  db()
    .insert(schema.userItemState)
    .values({ userId: who.id, releaseId, ...values });

const home = (who: Member | null, at = now) => api(who, at).memories.home();

async function listenIds(who: Member, at = now) {
  const memories = await home(who, at);
  return memories?.listens?.releases.map((r) => r.id) ?? null;
}

async function anniversaryIds(who: Member, at = now) {
  const memories = await home(who, at);
  return memories?.anniversaries.map((a) => a.release.id) ?? null;
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

/** Round trips to the database: the deepest chain of queries waiting on one another. */
function trackRoundTrips(database: unknown) {
  const client = (database as { $client: { query: (...args: unknown[]) => Promise<unknown> } })
    .$client;
  const query = client.query.bind(client);
  let answered = 0;
  let roundTrips = 0;
  client.query = async (...args) => {
    const depth = answered + 1;
    roundTrips = Math.max(roundTrips, depth);
    const result = await query(...args);
    await new Promise((resolve) => setTimeout(resolve, 1));
    answered = Math.max(answered, depth);
    return result;
  };
  return {
    take: () => {
      const count = roundTrips;
      answered = roundTrips = 0;
      return count;
    },
    restore: () => (client.query = query),
  };
}

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe("sameDayInPastYears", () => {
  it("lists the same day of every past year, from 1900 by default", () => {
    expect(sameDayInPastYears("2026-11-17", 2022)).toEqual([
      "2022-11-17",
      "2023-11-17",
      "2024-11-17",
      "2025-11-17",
    ]);
    const all = sameDayInPastYears("2026-11-17");
    expect(all).toHaveLength(126);
    expect(all[0]).toBe("1900-11-17");
    expect(all.at(-1)).toBe("2025-11-17");
    expect(sameDayInPastYears("1900-05-05")).toEqual([]);
  });

  it("handles the first and last days of the year and 28 February", () => {
    expect(sameDayInPastYears("2026-01-01", 2024)).toEqual(["2024-01-01", "2025-01-01"]);
    expect(sameDayInPastYears("2026-12-31", 2024)).toEqual(["2024-12-31", "2025-12-31"]);
    expect(sameDayInPastYears("2026-02-28", 2023)).toEqual([
      "2023-02-28",
      "2024-02-28",
      "2025-02-28",
    ]);
  });

  it("keeps 29 February to leap years only (1900 is not one, 2000 is)", () => {
    const days = sameDayInPastYears("2028-02-29");
    expect(days[0]).toBe("1904-02-29");
    expect(days).toContain("2000-02-29");
    expect(days.at(-1)).toBe("2024-02-29");
    expect(days).toHaveLength(31);
    expect(days).not.toContain("1900-02-29");
  });
});

describe("isRoundAnniversary", () => {
  it("is true for 10, 20, 25, 30, 40, 50, then every decade and 75", () => {
    for (const years of [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]) {
      expect(isRoundAnniversary(years), String(years)).toBe(true);
    }
    for (const years of [1, 5, 9, 15, 24, 26, 35, 45, 55, 65]) {
      expect(isRoundAnniversary(years), String(years)).toBe(false);
    }
  });

  it("agrees with its SQL twin", async () => {
    const rows = rowsOf<{ n: number; round: boolean }>(
      await db().execute(
        sql`select n, ${roundAnniversarySql(sql`n`)} as round from generate_series(1, 130) as n`,
      ),
    );
    expect(rows).toHaveLength(130);
    for (const row of rows) {
      expect(row.round, String(row.n)).toBe(isRoundAnniversary(Number(row.n)));
    }
  });
});

describe("memories.home: « Ce jour-là »", () => {
  it("keeps only dated listens of records on this very day of a past year", async () => {
    const me = await member();
    const kept = await record();
    const others = [await record(), await record(), await record(), await record()];
    await listen(me, kept.id, "2025-11-17");
    await listen(me, others[0]!.id, null); // undated
    await listen(me, others[1]!.id, "2025-11-16"); // the day before
    await listen(me, others[2]!.id, "2025-11-18"); // the day after
    await listen(me, others[3]!.id, "2026-11-17"); // today itself
    const [track] = await db()
      .insert(schema.tracks)
      .values({ slug: `t-${short()}`, title: "A track" })
      .returning();
    await db()
      .insert(schema.entries)
      .values({ userId: me.id, trackId: track!.id, listenedOn: "2025-11-17" });

    expect(await home(me)).toEqual({
      today: "2026-11-17",
      listens: {
        day: "2025-11-17",
        yearsAgo: 1,
        releases: [expect.objectContaining({ id: kept.id })],
      },
      anniversaries: [],
    });
  });

  it("builds tiles without community numbers, artists in their order", async () => {
    const me = await member();
    const r = await record({ type: "ep", coverUrl: "https://example.test/c.jpg" });
    const [first, second] = await db()
      .insert(schema.artists)
      .values([
        { slug: `a-${short()}`, name: "Zélie" },
        { slug: `a-${short()}`, name: "Anton" },
      ])
      .returning();
    await db()
      .insert(schema.releaseArtists)
      .values([
        { releaseId: r.id, artistId: second!.id, position: 2 },
        { releaseId: r.id, artistId: first!.id, position: 1 },
      ]);
    await listen(me, r.id, "2025-11-17");

    const [tile] = (await home(me))!.listens!.releases;
    expect(tile).toEqual({
      id: r.id,
      slug: r.slug,
      title: r.title,
      type: "ep",
      year: 2020,
      coverUrl: "https://example.test/c.jpg",
      artists: [
        { slug: first!.slug, name: "Zélie" },
        { slug: second!.slug, name: "Anton" },
      ],
    });
  });

  it("shows only the most recent past year that has listens", async () => {
    const me = await member();
    const [lastYear, older] = [await record(), await record()];
    await listen(me, lastYear.id, "2025-11-17");
    await listen(me, older.id, "2023-11-17");
    expect(await listenIds(me)).toEqual([lastYear.id]);

    const other = await member();
    await listen(other, older.id, "2023-11-17");
    expect((await home(other))?.listens).toMatchObject({ day: "2023-11-17", yearsAgo: 3 });
  });

  it("makes one tile per record, the most recently logged first, six at most", async () => {
    const me = await member();
    const [twice, at20, at21] = [await record(), await record(), await record()];
    await listen(me, twice.id, "2025-11-17", new Date("2025-11-17T10:00:00Z"));
    await listen(me, twice.id, "2025-11-17", new Date("2025-11-17T23:00:00Z"));
    await listen(me, at20.id, "2025-11-17", new Date("2025-11-17T20:00:00Z"));
    await listen(me, at21.id, "2025-11-17", new Date("2025-11-17T21:00:00Z"));
    expect(await listenIds(me)).toEqual([twice.id, at21.id, at20.id]);

    const busy = await member();
    for (let i = 0; i < MEMORIES_LISTENS_MAX + 2; i++) {
      await listen(busy, (await record()).id, "2025-11-17");
    }
    expect(await listenIds(busy)).toHaveLength(MEMORIES_LISTENS_MAX);
  });

  it("leaves out merged and postponed records, even when they fill the latest year", async () => {
    const me = await member();
    const kept = await record();
    const merged = await record({ mergedIntoId: kept.id });
    const postponed = await record({ releaseDate: "2027-03-01" });
    const valid = await record();
    await listen(me, merged.id, "2025-11-17");
    await listen(me, postponed.id, "2025-11-17");
    await listen(me, valid.id, "2024-11-17");

    expect((await home(me))?.listens).toMatchObject({ day: "2024-11-17", yearsAgo: 2 });
    expect(await listenIds(me)).toEqual([valid.id]);
  });

  it("uses the member's day, Paris when the zone is refused", async () => {
    const paris = await member("Europe/Paris");
    const la = await member("America/Los_Angeles");
    const broken = await member("Mars/Olympus_Mons");
    const [on17, on18] = [await record(), await record()];
    for (const who of [paris, la, broken]) {
      await listen(who, on17.id, "2025-11-17");
      await listen(who, on18.id, "2025-11-18");
    }
    expect(await listenIds(paris, midnight)).toEqual([on18.id]);
    expect(await listenIds(la, midnight)).toEqual([on17.id]);
    expect(await listenIds(broken, midnight)).toEqual([on18.id]);
    expect((await home(la, midnight))?.today).toBe("2026-11-17");
    expect((await home(paris, midnight))?.today).toBe("2026-11-18");
  });
});

describe("memories.home: « Anniversaires du jour »", () => {
  it("keeps records I rated or hearted, not those only listened or queued", async () => {
    const me = await member();
    const [rated, hearted, listened, queued] = [
      await record({ releaseDate: "2016-11-17" }),
      await record({ releaseDate: "2015-11-17" }),
      await record({ releaseDate: "2014-11-17" }),
      await record({ releaseDate: "2013-11-17" }),
    ];
    await state(me, rated.id, { listened: true, rating: 8 });
    await state(me, hearted.id, { listened: true, liked: true });
    await state(me, listened.id, { listened: true });
    await state(me, queued.id, { wantToListen: true });

    expect((await home(me))?.anniversaries).toEqual([
      { release: expect.objectContaining({ id: rated.id }), years: 10, round: true },
      { release: expect.objectContaining({ id: hearted.id }), years: 11, round: false },
    ]);
  });

  it("needs a date to the day, a past year and a main, unmerged record", async () => {
    const me = await member();
    const kept = await record({ releaseDate: "2016-11-17" });
    const mixtape = await record({ releaseDate: "2017-11-17", secondaryTypes: ["mixtape/street"] });
    const excluded = [
      await record({ releaseDate: "2016-11-17", releaseDatePrecision: "month" }),
      await record({ releaseDate: "2016-11-17", releaseDatePrecision: "year" }),
      await record({ releaseDate: "2026-11-17" }), // out today: not an anniversary
      await record({ releaseDate: "2027-11-17" }),
      await record({ releaseDate: "2016-11-17", secondaryTypes: ["live"] }),
      await record({ releaseDate: "2016-11-17", secondaryTypes: ["compilation"] }),
      await record({ releaseDate: "2016-11-17", mergedIntoId: kept.id }),
      await record({ releaseDate: null, releaseDatePrecision: null }),
    ];
    for (const r of [kept, mixtape, ...excluded]) await state(me, r.id, { liked: true });

    expect(await anniversaryIds(me)).toEqual([kept.id, mixtape.id]);
  });

  it("lists round ones first, then the oldest, then by title; six at most", async () => {
    const me = await member();
    const make = (year: number, title: string) => record({ releaseDate: `${year}-11-17`, title });
    const y30 = await make(1996, "Thirty");
    const y25 = await make(2001, "Twenty-five");
    const y10 = await make(2016, "Ten");
    const y12 = await make(2014, "Twelve");
    const y7b = await make(2019, "B seven");
    const y7a = await make(2019, "A seven");
    const y3 = await make(2023, "Three");
    for (const r of [y3, y7a, y7b, y12, y10, y25, y30]) await state(me, r.id, { rating: 7 });

    const memories = await home(me);
    expect(memories?.anniversaries).toHaveLength(MEMORIES_ANNIVERSARIES_MAX);
    expect(memories?.anniversaries.map((a) => [a.release.title, a.years, a.round])).toEqual([
      ["Thirty", 30, true],
      ["Twenty-five", 25, true],
      ["Ten", 10, true],
      ["Twelve", 12, false],
      ["A seven", 7, false],
      ["B seven", 7, false],
    ]);
  });

  it("brings 29 February back on 29 February only", async () => {
    const me = await member();
    const leap = await record({ releaseDate: "2004-02-29" });
    await state(me, leap.id, { liked: true });
    expect((await home(me, new Date("2028-02-29T12:00:00Z")))?.anniversaries).toEqual([
      { release: expect.objectContaining({ id: leap.id }), years: 24, round: false },
    ]);
    expect(await home(me, new Date("2027-02-28T12:00:00Z"))).toBeNull();
    expect(await home(me, new Date("2027-03-01T12:00:00Z"))).toBeNull();
  });

  it("uses the member's day around midnight", async () => {
    const paris = await member("Europe/Paris");
    const la = await member("America/Los_Angeles");
    const on17 = await record({ releaseDate: "2016-11-17" });
    const on18 = await record({ releaseDate: "2016-11-18" });
    for (const who of [paris, la]) {
      await state(who, on17.id, { rating: 6 });
      await state(who, on18.id, { rating: 6 });
    }
    expect(await anniversaryIds(paris, midnight)).toEqual([on18.id]);
    expect(await anniversaryIds(la, midnight)).toEqual([on17.id]);
  });

  it("keeps a record in both groups", async () => {
    const me = await member();
    const both = await record({ releaseDate: "2016-11-17" });
    await listen(me, both.id, "2025-11-17");
    await state(me, both.id, { listened: true, liked: true });
    expect(await listenIds(me)).toEqual([both.id]);
    expect(await anniversaryIds(me)).toEqual([both.id]);
  });
});

describe("memories.home: nothing to show", () => {
  it("answers null to visitors, suspended accounts, before onboarding, setting off, or empty", async () => {
    expect(await home(null)).toBeNull();
    expect(await home(await account())).toBeNull();
    expect(await home(await member())).toBeNull();

    const r = await record({ releaseDate: "2016-11-17" });
    const suspended = await member();
    await state(suspended, r.id, { liked: true });
    expect(await home(suspended)).not.toBeNull();
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now, suspensionReason: "Spam" })
      .where(eq(schema.profiles.userId, suspended.id));
    expect(await home(suspended)).toBeNull();

    const off = await member();
    await state(off, r.id, { liked: true });
    await api(off).account.setShowMemories({ enabled: false });
    expect(await home(off)).toBeNull();
    await api(off).account.setShowMemories({ enabled: true });
    expect(await anniversaryIds(off)).toEqual([r.id]);
  });

  it.skipIf(process.env.TEST_DATABASE_URL)(
    "costs two round trips, one with the setting off",
    async () => {
      const me = await member();
      const r = await record({ releaseDate: "2016-11-17" });
      await state(me, r.id, { liked: true });
      await listen(me, r.id, "2025-11-17");
      const tracker = trackRoundTrips(handle.db);
      try {
        // The account (shared with `account.me`), then the one query of both groups.
        expect(await home(me)).not.toBeNull();
        expect(tracker.take()).toBe(2);
        await db()
          .update(schema.profiles)
          .set({ showMemories: false })
          .where(eq(schema.profiles.userId, me.id));
        tracker.take();
        expect(await home(me)).toBeNull();
        expect(tracker.take()).toBe(1);
      } finally {
        tracker.restore();
      }
    },
  );
});

describe("account.setShowMemories", () => {
  it("toggles the setting, shown in account.me and the export", async () => {
    const m = await member();
    expect((await api(m).account.me())?.profile?.showMemories).toBe(true);
    await api(m).account.setShowMemories({ enabled: false });
    expect((await api(m).account.me())?.profile?.showMemories).toBe(false);
    const exported = await api(m).account.export();
    expect((exported.profile as { showMemories: boolean }).showMemories).toBe(false);
    await api(m).account.setShowMemories({ enabled: true });
    expect((await api(m).account.me())?.profile?.showMemories).toBe(true);
  });

  it("refuses visitors, suspended accounts and members without a profile", async () => {
    expect(await errorCode(() => api(null).account.setShowMemories({ enabled: false }))).toBe(
      "UNAUTHENTICATED",
    );
    const suspended = await member();
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now, suspensionReason: "Spam" })
      .where(eq(schema.profiles.userId, suspended.id));
    expect(await errorCode(() => api(suspended).account.setShowMemories({ enabled: false }))).toBe(
      "ACCOUNT_SUSPENDED",
    );
    const fresh = await account();
    expect(await errorCode(() => api(fresh).account.setShowMemories({ enabled: false }))).toBe(
      "PROFILE_REQUIRED",
    );
  });
});
