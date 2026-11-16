import { randomUUID } from "node:crypto";

import { schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UPCOMING_ARTIST_MAX, UPCOMING_MINE_MAX } from "./lib/catalog/upcoming";
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
