import { randomUUID } from "node:crypto";

import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { notifyReleasesOfDay } from "./jobs";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* « Sortie aujourd'hui » notifications (milestone 11, step 5), on an empty database. */

let handle: DbHandle;
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
// 20:00 UTC: already the 17th in Tokyo, still the 16th in Paris and Los Angeles.
const now = new Date("2026-11-16T20:00:00Z");
const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));

interface MemberOptions {
  timeZone?: string;
  notifyReleases?: boolean;
  suspended?: boolean;
  role?: "member" | "admin";
}

async function member(options: MemberOptions = {}): Promise<SessionUser> {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  await db()
    .insert(schema.profiles)
    .values({
      userId: row!.id,
      username,
      displayName: username,
      role: options.role ?? "member",
      ageConfirmedAt: now,
      timeZone: options.timeZone ?? "Europe/Paris",
      notifyReleases: options.notifyReleases ?? true,
      suspendedAt: options.suspended ? now : null,
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

interface ReleaseInput {
  date: string;
  precision?: "day" | "month" | "year";
  title?: string;
  secondary?: string[];
}

async function releases(artistIds: string[], inputs: ReleaseInput[]) {
  const rows = await db()
    .insert(schema.releases)
    .values(
      inputs.map((r) => ({
        slug: `release-${short()}`,
        title: r.title ?? `Release ${short()}`,
        type: "album" as const,
        secondaryTypes: r.secondary ?? [],
        releaseDate: r.date,
        releaseDatePrecision: r.precision ?? "day",
      })),
    )
    .returning();
  await db()
    .insert(schema.releaseArtists)
    .values(rows.flatMap((r) => artistIds.map((artistId) => ({ releaseId: r.id, artistId }))));
  return rows;
}

const follow = (userId: string, artistId: string) =>
  db().insert(schema.artistFollows).values({ userId, artistId, createdAt: now });

const rowsOf = (userId: string) =>
  db().select().from(schema.notifications).where(eq(schema.notifications.userId, userId));

const run = (users: SessionUser[], at = now) =>
  notifyReleasesOfDay(db(), at, { userIds: users.map((u) => u.id) });

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(() => handle.close());

describe("notifyReleasesOfDay", () => {
  it("uses each member's own today, on both sides of midnight", async () => {
    const a = await artist();
    const [out16, out17] = await releases([a.id], [{ date: "2026-11-16" }, { date: "2026-11-17" }]);
    const tokyo = await member({ timeZone: "Asia/Tokyo" });
    const angeles = await member({ timeZone: "America/Los_Angeles" });
    const paris = await member();
    for (const m of [tokyo, angeles, paris]) await follow(m.id, a.id);

    expect(await run([tokyo, angeles, paris])).toBe(3);
    expect((await rowsOf(tokyo.id)).map((r) => r.releaseId)).toEqual([out17!.id]);
    expect((await rowsOf(angeles.id)).map((r) => r.releaseId)).toEqual([out16!.id]);
    const [row] = await rowsOf(paris.id);
    expect(row).toMatchObject({
      releaseId: out16!.id,
      type: "release",
      actorId: null,
      groupKey: "release:day:2026-11-16",
    });

    // Half past midnight in Paris: its 17th has begun, Los Angeles is still on the 16th.
    expect(await run([paris, angeles], new Date("2026-11-16T23:30:00Z"))).toBe(1);
    expect((await rowsOf(paris.id)).map((r) => r.groupKey).sort()).toEqual([
      "release:day:2026-11-16",
      "release:day:2026-11-17",
    ]);
  });

  it("never notifies twice, even for a record of two followed artists", async () => {
    const [a, b] = [await artist(), await artist()];
    await releases([a.id, b.id], [{ date: "2026-11-16" }]);
    const m = await member();
    await follow(m.id, a.id);
    await follow(m.id, b.id);
    expect(await run([m])).toBe(1);
    expect(await run([m])).toBe(0);
    expect(await rowsOf(m.id)).toHaveLength(1);
  });

  it("skips suspended members, the setting off, unknown days and other releases", async () => {
    const a = await artist();
    await releases(
      [a.id],
      [
        { date: "2026-11-01", precision: "month" },
        { date: "2026-01-01", precision: "year" },
        { date: "2026-11-16", secondary: ["compilation"] },
        { date: "2026-11-15" },
      ],
    );
    const [b] = [await artist()];
    await releases([b.id], [{ date: "2026-11-16" }]);
    const suspended = await member({ suspended: true });
    const off = await member({ notifyReleases: false });
    const curious = await member();
    for (const m of [suspended, off]) await follow(m.id, b.id);
    await follow(curious.id, a.id);
    expect(await run([suspended, off, curious])).toBe(0);
  });

  it("falls back to Paris for a zone it does not know", async () => {
    const a = await artist();
    const [out] = await releases([a.id], [{ date: "2026-11-16" }]);
    const lost = await member({ timeZone: "Mars/Olympus" });
    await follow(lost.id, a.id);
    expect(await run([lost])).toBe(1);
    expect((await rowsOf(lost.id))[0]?.releaseId).toBe(out!.id);
  });
});

describe("reading release notifications", () => {
  it("one group per day: the first 3 records by title, and the count", async () => {
    const a = await artist();
    await releases(
      [a.id],
      ["Delta", "Alpha", "Charlie", "Bravo"].map((title) => ({ date: "2026-11-16", title })),
    );
    const m = await member();
    await follow(m.id, a.id);
    await run([m]);
    const { items } = await api(m).notification.list({});
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "release",
      key: "release:day:2026-11-16",
      unread: true,
      actors: [],
      releaseCount: 4,
    });
    expect(items[0]!.releases.map((r) => r.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(items[0]!.releases[0]!.artists.map((x) => x.name)).toEqual([a.name]);
    expect(await api(m).notification.unreadCount()).toBe(1);
  });

  it("a merged duplicate moves to the record kept, once per member", async () => {
    const admin = await member({ role: "admin" });
    const a = await artist();
    const [keep, dup] = await releases([a.id], [{ date: "2026-11-16" }, { date: "2026-11-16" }]);
    const both = await member();
    await follow(both.id, a.id);
    await run([both]);
    expect(await rowsOf(both.id)).toHaveLength(2);
    await api(admin).admin.merge({
      kind: "release",
      keep: keep!.slug,
      duplicate: dup!.slug,
      reason: "Même disque importé deux fois",
    });
    expect((await rowsOf(both.id)).map((r) => r.releaseId)).toEqual([keep!.id]);
    const [group] = (await api(both).notification.list({})).items;
    expect(group).toMatchObject({ releaseCount: 1 });
    expect(group!.releases[0]!.slug).toBe(keep!.slug);
  });
});
