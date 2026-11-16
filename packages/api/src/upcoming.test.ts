import { randomUUID } from "node:crypto";

import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AWAITED_MAX,
  UPCOMING_ARTIST_MAX,
  UPCOMING_HOME_MAX,
  UPCOMING_MINE_MAX,
} from "./lib/catalog/upcoming";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* Upcoming releases (milestone 11, step 2): the shared rule, its groups and its two reads. */

let handle: DbHandle;
// A Monday; 13:00 in Paris, already Tuesday in Kiritimati (UTC+14).
const now = new Date("2026-11-16T12:00:00Z");
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));

async function member(timeZone = "Europe/Paris"): Promise<SessionUser> {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  await db().insert(schema.profiles).values({
    userId: row!.id,
    username,
    displayName: username,
    ageConfirmedAt: now,
    timeZone,
  });
  return { id: row!.id, email: row!.email };
}

async function artist() {
  const [row] = await db()
    .insert(schema.artists)
    .values({ slug: `artist-${short()}`, name: `Artist ${short()}` })
    .returning();
  return row!;
}

const follow = (userId: string, artistId: string) =>
  db().insert(schema.artistFollows).values({ userId, artistId, createdAt: now });

interface ReleaseInput {
  date: string;
  precision?: "day" | "month" | "year";
  announced?: boolean;
  changed?: boolean;
  type?: "album" | "ep" | "single";
  secondary?: string[];
  title?: string;
}

/** Releases of `artistId`; a month or a year is stored on its first day. */
async function releases(artistId: string, inputs: ReleaseInput[]) {
  const rows = await db()
    .insert(schema.releases)
    .values(
      inputs.map((r) => {
        const precision = r.precision ?? "day";
        const date =
          precision === "year"
            ? `${r.date}-01-01`
            : precision === "month"
              ? `${r.date}-01`
              : r.date;
        return {
          slug: `release-${short()}`,
          title: r.title ?? `Release ${r.date} ${precision}`,
          type: r.type ?? "album",
          secondaryTypes: r.secondary ?? [],
          releaseDate: date,
          releaseDatePrecision: precision,
          announcedAt: r.announced ? new Date("2026-06-01T00:00:00Z") : null,
          releaseDateChangedAt: r.changed ? new Date("2026-10-01T00:00:00Z") : null,
        };
      }),
    )
    .returning();
  await db()
    .insert(schema.releaseArtists)
    .values(rows.map((r) => ({ releaseId: r.id, artistId })));
  return rows;
}

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(() => handle.close());

describe("upcoming rule and groups", () => {
  it("applies each precision, the 12 months limit and the groups", async () => {
    const user = await member();
    const a = await artist();
    await follow(user.id, a.id);
    await releases(a.id, [
      { date: "2026-11-16" }, // today: out
      { date: "2026-11-19" }, // week
      { date: "2026-11-23" }, // J+7: week
      { date: "2026-11-26" }, // month
      { date: "2026-12-02", changed: true }, // later
      { date: "2027-11-16" }, // 12 months: later
      { date: "2027-11-17" }, // beyond: out
      { date: "2026-11", precision: "month", announced: true }, // month
      { date: "2026-11", precision: "month" }, // current month never announced: out
      { date: "2027-01", precision: "month" }, // later
      { date: "2027-12", precision: "month" }, // beyond: out
      { date: "2027", precision: "year" }, // tba
      { date: "2026", precision: "year", announced: true }, // tba
      { date: "2026", precision: "year" }, // out
      { date: "2028", precision: "year" }, // out
      { date: "2026-12-10", secondary: ["live"] }, // not a main release: out
    ]);
    const items = await api(user).upcoming.mine({});
    expect(items.map((i) => [i.date, i.precision, i.group])).toEqual([
      ["2026-01-01", "year", "tba"],
      ["2026-11-01", "month", "month"],
      ["2026-11-19", "day", "week"],
      ["2026-11-23", "day", "week"],
      ["2026-11-26", "day", "month"],
      ["2026-12-02", "day", "later"],
      // Same date: by title ("Release 2027 year" before "Release 2027-01 month").
      ["2027-01-01", "year", "tba"],
      ["2027-01-01", "month", "later"],
      ["2027-11-16", "day", "later"],
    ]);
    expect(items.find((i) => i.date === "2026-12-02")?.dateChanged).toBe(true);
    expect(items.find((i) => i.date === "2026-11-19")?.dateChanged).toBe(false);
  });

  it("reads only followed artists, one type when asked, in the member's zone", async () => {
    const user = await member("Pacific/Kiritimati");
    const [followed, other] = [await artist(), await artist()];
    await follow(user.id, followed.id);
    await releases(followed.id, [
      { date: "2026-11-17", type: "single" }, // today in Kiritimati: out
      { date: "2026-11-18", type: "single" },
      { date: "2026-11-20", type: "ep" },
    ]);
    await releases(other.id, [{ date: "2026-11-20" }]);
    expect((await api(user).upcoming.mine({})).map((i) => i.date)).toEqual([
      "2026-11-18",
      "2026-11-20",
    ]);
    expect((await api(user).upcoming.mine({ type: "ep" })).map((i) => i.release.type)).toEqual([
      "ep",
    ]);
  });

  it(`keeps ${UPCOMING_MINE_MAX} items at most, by date then title`, async () => {
    const user = await member();
    const a = await artist();
    await follow(user.id, a.id);
    await releases(
      a.id,
      Array.from({ length: UPCOMING_MINE_MAX + 1 }, (_, i) => ({
        date: "2026-12-20",
        title: `T${String(i).padStart(3, "0")}`,
      })),
    );
    const items = await api(user).upcoming.mine({});
    expect(items).toHaveLength(UPCOMING_MINE_MAX);
    expect(items[0]!.release.title).toBe("T000");
  });

  it("needs a signed-in member", async () => {
    await expect(api(null).upcoming.mine({})).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("recent releases", () => {
  it("leave out what is upcoming, and take a release in once its period begins", async () => {
    const a = await artist();
    const [announced, unannounced] = await releases(a.id, [
      { date: "2026-11", precision: "month", announced: true },
      { date: "2026-11", precision: "month" },
    ]);
    const recentIds = async (at: Date) =>
      (
        await createCaller(
          createContext({ now: at, db: () => handle.db, user: async () => null }),
        ).discovery.recent({ size: 24 })
      ).items.map((c) => c.id);
    const today = await recentIds(now);
    expect(today).toContain(unannounced!.id);
    expect(today).not.toContain(announced!.id);
    // In December, November is no longer upcoming: the release is recent.
    expect(await recentIds(new Date("2026-12-02T12:00:00Z"))).toContain(announced!.id);
  });
});

describe("from upcoming to recent releases", () => {
  it("moves a day release on the day it stops being upcoming", async () => {
    const a = await artist();
    const fans = [await member(), await member()];
    for (const m of fans) await follow(m.id, a.id);
    const [tomorrow] = await releases(a.id, [{ date: "2026-11-17" }]);
    const at = (when: Date) =>
      createCaller(createContext({ now: when, db: () => handle.db, user: async () => fans[0]! }));
    const read = async (when: Date) => {
      const caller = at(when);
      const [recent, awaited, mine] = await Promise.all([
        caller.discovery.recent({ size: 24 }),
        caller.discovery.awaited(),
        caller.upcoming.mine({}),
      ]);
      return {
        recent: recent.items.some((c) => c.id === tomorrow!.id),
        awaited: awaited.some((i) => i.release.id === tomorrow!.id),
        mine: mine.some((i) => i.release.id === tomorrow!.id),
      };
    };
    expect(await read(now)).toEqual({ recent: false, awaited: true, mine: true });
    // The next day at 13:00 in Paris: out.
    expect(await read(new Date("2026-11-17T12:00:00Z"))).toEqual({
      recent: true,
      awaited: false,
      mine: false,
    });
  });
});

describe("upcoming.home", () => {
  it("is null for a visitor, and says when the member follows nobody", async () => {
    expect(await api(null).upcoming.home()).toBeNull();
    const m = await member();
    expect(await api(m).upcoming.home()).toEqual({ following: false, items: [], soon: null });
  });

  it(`gives the next ${UPCOMING_HOME_MAX} releases, year-only ones last`, async () => {
    const a = await artist();
    const m = await member();
    await follow(m.id, a.id);
    const rows = await releases(a.id, [
      { date: "2027", precision: "year" },
      { date: "2027-01-15" },
      { date: "2026-12-01" },
      { date: "2026-12-02" },
      { date: "2026-12-03" },
      { date: "2026-12-04" },
    ]);
    const home = await api(m).upcoming.home();
    expect(home!.following).toBe(true);
    expect(home!.items.map((i) => i.release.id)).toEqual(
      [rows[2], rows[3], rows[4], rows[5], rows[1]].map((r) => r!.id),
    );
    const few = await member();
    const b = await artist();
    await follow(few.id, b.id);
    const [year, day] = await releases(b.id, [
      { date: "2027", precision: "year" },
      { date: "2027-06-30" },
    ]);
    expect((await api(few).upcoming.home())!.items.map((i) => i.release.id)).toEqual([
      day!.id,
      year!.id,
    ]);
  });

  it("finds the « Sort … » release from tomorrow to 6 days ahead, in the member's zone", async () => {
    const soonOf = async (timeZone: string, inputs: ReleaseInput[]) => {
      const a = await artist();
      const m = await member(timeZone);
      await follow(m.id, a.id);
      const rows = await releases(a.id, inputs);
      const soon = (await api(m).upcoming.home())!.soon;
      return (
        soon && { index: rows.findIndex((r) => r.id === soon.item.release.id), days: soon.inDays }
      );
    };
    expect(await soonOf("Europe/Paris", [{ date: "2026-11-22" }, { date: "2026-11-17" }])).toEqual({
      index: 1,
      days: 1,
    });
    expect(await soonOf("Europe/Paris", [{ date: "2026-11-22" }])).toEqual({ index: 0, days: 6 });
    // Too far, a month or today (not upcoming): no card.
    expect(
      await soonOf("Europe/Paris", [
        { date: "2026-11-23" },
        { date: "2026-11", precision: "month", announced: true },
        { date: "2026-11-16" },
      ]),
    ).toBeNull();
    // Already Tuesday in Kiritimati: the 17th is today there, the 18th tomorrow.
    expect(
      await soonOf("Pacific/Kiritimati", [{ date: "2026-11-17" }, { date: "2026-11-18" }]),
    ).toEqual({ index: 1, days: 1 });
  });
});

describe("discovery.awaited", () => {
  const queue = (m: SessionUser, releaseId: string) =>
    api(m).listening.setWantToListen({
      target: { kind: "release", id: releaseId },
      wantToListen: true,
    });

  it("ranks by distinct members (follow or « À écouter »), 2 at least, suspended left out", async () => {
    const a = await artist();
    const b = await artist();
    const [m1, m2, m3, suspended] = [
      await member(),
      await member(),
      await member(),
      await member(),
    ];
    await db()
      .update(schema.profiles)
      .set({ suspendedAt: now })
      .where(eq(schema.profiles.userId, suspended.id));
    const [three, two, alone, past] = [
      ...(await releases(a.id, [{ date: "2027-03-01" }, { date: "2026-12-10" }])),
      ...(await releases(b.id, [{ date: "2026-12-11" }, { date: "2026-11-10" }])),
    ];
    // `three`: m1 and m2 follow its artist, m3 queued it (m1 too: counted once).
    await follow(m1.id, a.id);
    await follow(m2.id, a.id);
    await queue(m3, three!.id);
    await queue(m1, three!.id);
    // `two`: m1 and m2 (artist a). `alone`: m3 and a suspended member. `past`: out already.
    await follow(m3.id, b.id);
    await follow(suspended.id, b.id);
    const ids = (await api(null).discovery.awaited()).map((i) => i.release.id);
    expect(ids.indexOf(three!.id)).toBeLessThan(ids.indexOf(two!.id));
    expect(ids).toContain(two!.id);
    expect(ids).not.toContain(alone!.id);
    expect(ids).not.toContain(past!.id);
    // The same for a member (no reader data).
    const mine = await api(m1).discovery.awaited();
    expect(mine.map((i) => i.release.id)).toEqual(ids);
    expect(mine.every((i) => !i.wantToListen)).toBe(true);
  });

  it(`breaks ties by the nearest date, year-only last, ${AWAITED_MAX} at most`, async () => {
    const a = await artist();
    const fans = [await member(), await member(), await member(), await member(), await member()];
    for (const m of fans) await follow(m.id, a.id);
    const rows = await releases(a.id, [
      { date: "2027", precision: "year" },
      ...Array.from({ length: AWAITED_MAX + 1 }, (_, i) => ({
        date: `2027-02-${String(i + 10).padStart(2, "0")}`,
      })),
    ]);
    const ids = (await api(null).discovery.awaited()).map((i) => i.release.id);
    expect(ids).toHaveLength(AWAITED_MAX);
    // Five members beat every record of the other tests (four at most).
    expect(ids).toEqual(rows.slice(1, AWAITED_MAX + 1).map((r) => r.id));
  });
});

describe("upcoming.byArtist", () => {
  it("is the same for a visitor and a member, and follows a merged artist", async () => {
    const kept = await artist();
    const [merged] = await db()
      .insert(schema.artists)
      .values({ slug: `artist-${short()}`, name: "Duplicate", mergedIntoId: kept.id })
      .returning();
    await releases(
      kept.id,
      Array.from({ length: UPCOMING_ARTIST_MAX + 2 }, (_, i) => ({
        date: `2027-02-${String(i + 1).padStart(2, "0")}`,
      })),
    );
    const visitor = await api(null).upcoming.byArtist({ slug: kept.slug });
    expect(visitor).toHaveLength(UPCOMING_ARTIST_MAX);
    expect(visitor[0]!.date).toBe("2027-02-01");
    expect(await api(await member()).upcoming.byArtist({ slug: kept.slug })).toEqual(visitor);
    expect(await api(null).upcoming.byArtist({ slug: merged!.slug })).toEqual(visitor);
  });

  it("answers NOT_FOUND for an unknown artist", async () => {
    await expect(api(null).upcoming.byArtist({ slug: "nobody-here" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("upcoming on the item pages", () => {
  it("marks the release page and the member's state, in each one's zone", async () => {
    const a = await artist();
    // Tomorrow in Paris, already today in Kiritimati.
    const [soon] = await releases(a.id, [{ date: "2026-11-17", changed: true }]);
    const [out] = await releases(a.id, [{ date: "2026-11-10" }]);
    const page = await api(null).release.bySlug({ slug: soon!.slug });
    expect(page?.upcoming).toEqual({ dateChanged: true });
    expect((await api(null).release.bySlug({ slug: out!.slug }))?.upcoming).toBeNull();

    const paris = await member();
    const kiritimati = await member("Pacific/Kiritimati");
    const target = { kind: "release" as const, id: soon!.id };
    expect((await api(paris).listening.myState(target))?.releaseNotOut).toBe(true);
    expect((await api(kiritimati).listening.myState(target))?.releaseNotOut).toBe(false);
  });

  it("gives each upcoming item the reader's « À écouter »", async () => {
    const a = await artist();
    const m = await member();
    await follow(m.id, a.id);
    const [queued, other] = await releases(a.id, [{ date: "2026-12-01" }, { date: "2026-12-02" }]);
    await api(m).listening.setWantToListen({
      target: { kind: "release", id: queued!.id },
      wantToListen: true,
    });
    const mine = await api(m).upcoming.mine({});
    expect(mine.find((i) => i.release.id === queued!.id)?.wantToListen).toBe(true);
    expect(mine.find((i) => i.release.id === other!.id)?.wantToListen).toBe(false);
    const byArtist = await api(m).upcoming.byArtist({ slug: a.slug });
    expect(byArtist.every((i) => !i.wantToListen)).toBe(true);
  });
});

describe("upcoming.suggestions", () => {
  async function listenTo(userId: string, artistId: string, times: number) {
    const [r] = await releases(artistId, [{ date: "2020-01-01" }]);
    await db()
      .insert(schema.entries)
      .values(
        Array.from({ length: times }, (_, i) => ({
          userId,
          releaseId: r!.id,
          listenedOn: `2026-0${i + 1}-10`,
        })),
      );
  }

  it("is empty with no listens this year, and counts the follows", async () => {
    const m = await member();
    await follow(m.id, (await artist()).id);
    expect(await api(m).upcoming.suggestions()).toEqual({ following: 1, artists: [] });
  });

  it("gives the top artists not followed, in order, and the artist kept after a merge", async () => {
    const m = await member();
    const [top, followed, second, kept] = [
      await artist(),
      await artist(),
      await artist(),
      await artist(),
    ];
    const merged = await artist();
    await db()
      .update(schema.artists)
      .set({ mergedIntoId: kept.id })
      .where(eq(schema.artists.id, merged.id));
    await listenTo(m.id, top.id, 5);
    await listenTo(m.id, followed.id, 4);
    await listenTo(m.id, second.id, 3);
    await listenTo(m.id, merged.id, 2);
    await follow(m.id, followed.id);
    const result = await api(m).upcoming.suggestions();
    expect(result.following).toBe(1);
    expect(result.artists.map((a) => a.id)).toEqual([top.id, second.id, kept.id]);
    expect(result.artists[2]).toEqual({ id: kept.id, slug: kept.slug, name: kept.name });
  });

  it("needs a signed-in member", async () => {
    await expect(api(null).upcoming.suggestions()).rejects.toBeInstanceOf(TRPCError);
  });
});
