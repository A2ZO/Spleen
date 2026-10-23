import { createDb, eq, schema, seed, sql, type DbHandle } from "@spleen/db";
import { fixtureId } from "@spleen/db/fixtures";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DIARY_PAGE_SIZE } from "./lib/profiles";
import { computeStats, getMemberStats, readStatsMember, storeStats } from "./lib/stats";
import { computeBaseStats } from "./lib/stats/base";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");

const nocturnes = fixtureId(201);
const leRoi = fixtureId(202);
const smokeRings = fixtureId(203);
const sousLePeriph = fixtureId(206); // EP
const midnightBlue = fixtureId(209); // single
const cafeCreme = fixtureId(208);
const leRoiTrack = (n: number) => fixtureId(10_100 + n);
const release = (id: string) => ({ kind: "release" as const, id });

beforeAll(async () => {
  handle = createDb("memory://");
  await handle.migrate();
  await seed(handle.db);
}, 60_000);

afterAll(async () => {
  await handle.close();
});

function api(user: SessionUser | null, at = now) {
  return createCaller(createContext({ now: at, db: () => handle.db, user: async () => user }));
}

let memberCount = 0;
async function member(options: { timeZone?: string; blindMode?: boolean } = {}) {
  memberCount += 1;
  const username = `profiler${memberCount}`;
  const email = `${username}@example.test`;
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email, emailVerified: true })
    .returning();
  const user = { id: row!.id, email };
  await api(user).account.onboard({
    username,
    displayName: username,
    ageConfirmed: true,
    locale: "fr",
    theme: "dark",
    timeZone: options.timeZone ?? "Europe/Paris",
  });
  if (options.blindMode) {
    await handle.db
      .update(schema.profiles)
      .set({ blindMode: true })
      .where(eq(schema.profiles.userId, user.id));
  }
  return { user, username, call: (at = now) => api(user, at) };
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

const listen = (
  target: { kind: "release" | "track"; id: string },
  listenedOn: string,
  extra: {
    rating?: number;
    relisten?: boolean;
    trackRatings?: { trackId: string; rating: number }[];
  } = {},
) => ({
  target,
  listenedOn,
  rating: extra.rating ?? null,
  liked: false,
  relisten: extra.relisten ?? false,
  format: null,
  moodIds: [],
  trackRatings: extra.trackRatings ?? [],
});

describe("the Shelf", () => {
  it("puts records in slots, moves them, replaces and removes them", async () => {
    const m = await member();
    const shelf = async () => (await m.call().shelf.mine()).map((c) => c?.id ?? null);
    await m.call().shelf.set({ releaseId: nocturnes, position: 1 });
    await m.call().shelf.set({ releaseId: midnightBlue, position: 3 }); // a single is fine
    expect(await shelf()).toEqual([nocturnes, null, midnightBlue, null]);

    // Already on the Shelf: moves instead of duplicating.
    await m.call().shelf.set({ releaseId: nocturnes, position: 4 });
    expect(await shelf()).toEqual([null, null, midnightBlue, nocturnes]);

    // Occupied slot: replaced.
    await m.call().shelf.set({ releaseId: leRoi, position: 3 });
    expect(await shelf()).toEqual([null, null, leRoi, nocturnes]);

    await m.call().shelf.remove({ position: 4 });
    expect(await shelf()).toEqual([null, null, leRoi, null]);
    const profile = await api(null).profile.byUsername({ username: m.username });
    expect(profile?.shelf.map((c) => c?.id ?? null)).toEqual([null, null, leRoi, null]);
  });

  it("reorders the same records only", async () => {
    const m = await member();
    await m.call().shelf.set({ releaseId: nocturnes, position: 1 });
    await m.call().shelf.set({ releaseId: leRoi, position: 2 });
    await m.call().shelf.reorder({ releaseIds: [null, leRoi, null, nocturnes] });
    expect((await m.call().shelf.mine()).map((c) => c?.id ?? null)).toEqual([
      null,
      leRoi,
      null,
      nocturnes,
    ]);
    expect(
      await errorCode(() =>
        m.call().shelf.reorder({ releaseIds: [smokeRings, leRoi, null, nocturnes] }),
      ),
    ).toBe("SHELF_MISMATCH");
    expect(
      await errorCode(() => m.call().shelf.reorder({ releaseIds: [leRoi, leRoi, null, null] })),
    ).toBe("SHELF_MISMATCH");
  });

  it("refuses unknown records and visitors", async () => {
    const m = await member();
    expect(
      await errorCode(() => m.call().shelf.set({ releaseId: fixtureId(999), position: 1 })),
    ).toBe("ITEM_NOT_FOUND");
    expect(await errorCode(() => api(null).shelf.set({ releaseId: nocturnes, position: 1 }))).toBe(
      "UNAUTHENTICATED",
    );
  });
});

describe("hearts", () => {
  it("lists hearted records, most recently hearted first; a new heart gets a new date", async () => {
    const m = await member();
    const likes = async () =>
      (await api(null).profile.likes({ username: m.username, page: 1 }))?.items.map(
        (i) => i.release.id,
      );
    await m.call(new Date("2026-10-01T10:00:00Z")).listening.quickLike({
      target: release(nocturnes),
      liked: true,
    });
    await m.call(new Date("2026-10-02T10:00:00Z")).listening.quickLike({
      target: release(leRoi),
      liked: true,
    });
    expect(await likes()).toEqual([leRoi, nocturnes]);

    // Re-rating keeps the heart and its date.
    await m.call(new Date("2026-10-03T10:00:00Z")).listening.quickRate({
      target: release(nocturnes),
      rating: 8,
    });
    expect(await likes()).toEqual([leRoi, nocturnes]);

    // Removed then given again: the newest heart.
    await m.call(new Date("2026-10-04T10:00:00Z")).listening.quickLike({
      target: release(nocturnes),
      liked: false,
    });
    expect(await likes()).toEqual([leRoi]);
    await m.call(new Date("2026-10-05T10:00:00Z")).listening.quickLike({
      target: release(nocturnes),
      liked: true,
    });
    const page = await api(null).profile.likes({ username: m.username, page: 1 });
    expect(page?.items.map((i) => i.release.id)).toEqual([nocturnes, leRoi]);
    // Edit times come from the database clock, not the request's `now`.
    expect(page!.items[0]!.likedAt > page!.items[1]!.likedAt).toBe(true);
  });

  it("follow the diary's privacy", async () => {
    const m = await member();
    await m.call().listening.quickLike({ target: release(nocturnes), liked: true });
    await handle.db
      .update(schema.profiles)
      .set({ diaryPrivate: true })
      .where(eq(schema.profiles.userId, m.user.id));
    const page = { username: m.username, page: 1 };
    expect((await api(null).profile.likes(page))?.items).toEqual([]);
    expect((await m.call().profile.likes(page))?.items).toHaveLength(1);
  });
});

describe("diary list and calendar", () => {
  it("pages dated listens and never shows undated ones", async () => {
    const m = await member();
    const total = DIARY_PAGE_SIZE + 2;
    for (let i = 0; i < total; i += 1) {
      const day = String((i % 28) + 1).padStart(2, "0");
      const month = i < 28 ? "09" : "10";
      await m.call().listening.entry.create(listen(release(nocturnes), `2026-${month}-${day}`));
    }
    await m.call().listening.quickRate({ target: release(leRoi), rating: 6 }); // undated

    const first = await api(null).profile.diary({ username: m.username, page: 1 });
    expect(first).toMatchObject({ page: 1, pageCount: 2, total });
    expect(first?.items).toHaveLength(DIARY_PAGE_SIZE);
    expect(first?.items[0]?.listenedOn).toBe("2026-10-04");
    const second = await api(null).profile.diary({ username: m.username, page: 2 });
    expect(second?.items.map((e) => e.listenedOn)).toEqual(["2026-09-02", "2026-09-01"]);
    const all = [...first!.items, ...second!.items];
    expect(all.some((e) => e.release.id === leRoi)).toBe(false);
  });

  it("shows one month on the calendar, oldest first, without undated listens", async () => {
    const m = await member();
    await m.call().listening.entry.create(listen(release(nocturnes), "2026-08-31"));
    await m.call().listening.entry.create(listen(release(leRoi), "2026-09-15"));
    await m.call().listening.entry.create(listen(release(smokeRings), "2026-09-01"));
    await m.call().listening.entry.create(listen(release(cafeCreme), "2026-10-01"));
    await m.call().listening.quickRate({ target: release(midnightBlue), rating: 6 });
    const month = await api(null).profile.diaryMonth({ username: m.username, month: "2026-09" });
    expect(month?.map((e) => [e.listenedOn, e.release.id])).toEqual([
      ["2026-09-01", smokeRings],
      ["2026-09-15", leRoi],
    ]);
    const december = await api(null).profile.diaryMonth({
      username: m.username,
      month: "2026-12",
    });
    expect(december).toEqual([]);
  });
});

describe("blind listening on profiles", () => {
  it("hides review ratings of records the viewer has not rated", async () => {
    const author = await member();
    await author.call().listening.entry.create({
      ...listen(release(nocturnes), "2026-10-10", { rating: 9 }),
      review: { body: "La pluie, encore.", lang: "fr" },
    });
    const viewer = await member({ blindMode: true });
    const page = { username: author.username, page: 1 };
    const [hidden] = (await viewer.call().profile.reviews(page))!.items;
    expect(hidden).toMatchObject({ rating: null, release: { ratingsHidden: true } });
    expect((await api(null).profile.reviews(page))?.items[0]?.rating).toBe(9);

    await viewer.call().listening.quickRate({ target: release(nocturnes), rating: 4 });
    const [shown] = (await viewer.call().profile.reviews(page))!.items;
    expect(shown?.rating).toBe(9);
    expect(shown?.release.ratingsHidden).toBeUndefined();
  });
});

describe("review edit screen", () => {
  it("loads the member's own review only", async () => {
    const author = await member();
    const { id } = await author.call().review.create({
      target: release(leRoi),
      body: "Pluvieux et royal.",
      lang: "fr",
    });
    expect(await author.call().review.mine({ id })).toMatchObject({
      id,
      body: "Pluvieux et royal.",
      release: { id: leRoi },
    });
    const other = await member();
    expect(await other.call().review.mine({ id })).toBeNull();
  });
});

describe("base stats", () => {
  let vintage: string;
  beforeAll(async () => {
    const [row] = await handle.db
      .insert(schema.releases)
      .values({ slug: "vintage-1959", title: "Vintage", type: "album", releaseDate: "1959-08-17" })
      .returning({ id: schema.releases.id });
    vintage = row!.id;
  });

  it("follows the rules of lib/stats/source.ts", async () => {
    const m = await member();
    const c = m.call();
    await c.listening.entry.create(listen(release(nocturnes), "2026-03-01", { rating: 6 }));
    await c.listening.entry.create(
      listen(release(nocturnes), "2026-05-01", { rating: 10, relisten: true }),
    );
    await c.listening.entry.create(listen(release(sousLePeriph), "2025-12-01", { rating: 4 }));
    await c.listening.quickRate({ target: release(midnightBlue), rating: 8 }); // undated single
    await c.listening.entry.create(listen({ kind: "track", id: leRoiTrack(1) }, "2026-06-01"));
    // Track ratings inside an album listen do not count as listened tracks.
    await c.listening.entry.create(
      listen(release(leRoi), "2026-07-01", {
        trackRatings: [{ trackId: leRoiTrack(2), rating: 7 }],
      }),
    );
    await c.listening.entry.create(listen(release(vintage), "2026-08-15"));

    const stats = (await api(null).profile.stats({ username: m.username }))!;
    expect(stats).toMatchObject({ tier: "free", plus: null });
    const base = stats.base;
    expect(base.year).toBe(2026);
    expect(base.listenedThisYear).toEqual({ album: 3, ep: 0, single: 0, track: 1 });
    expect(base.listenedTotal).toEqual({ album: 3, ep: 1, single: 1, track: 1 });
    // Current rating per release: nocturnes 10 (most recently edited), EP 4, single 8.
    expect(base.ratingDistribution).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 1]);
    // Listens, relistens included; the track listen credits its artist.
    expect(base.topArtists).toEqual([
      { slug: "lune-basse", name: "Lune Basse", count: 2 },
      { slug: "odette-marchal", name: "Odette Marchal", count: 2 },
    ]);
    expect(base.topGenres).toEqual([
      { name: "Ambient", count: 2 },
      { name: "Jazz", count: 2 },
      { name: "Baroque pop", count: 1 },
      { name: "Chanson", count: 1 },
    ]);
    // All-time release listens, undated included.
    expect(base.decades).toEqual([
      { decade: 1950, count: 1 },
      { decade: 2020, count: 5 },
    ]);
    expect(base.activityByMonth).toEqual([0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
  });

  it("uses the member's time zone for the current year", async () => {
    // 2026-12-31 12:00 UTC is already 2027-01-01 in Kiritimati (UTC+14).
    const at = new Date("2026-12-31T12:00:00Z");
    const m = await member({ timeZone: "Pacific/Kiritimati" });
    await m.call(at).listening.entry.create(listen(release(leRoi), "2026-12-31"));
    await m.call(at).listening.markListened(release(nocturnes));
    const stats = await api(null, at).profile.stats({ username: m.username });
    expect(stats?.base.year).toBe(2027);
    expect(stats?.base.listenedThisYear.album).toBe(1);
    expect(stats?.base.activityByMonth[0]).toBe(1);
  });

  it("is hidden when private, except from the member", async () => {
    const m = await member();
    await handle.db
      .update(schema.profiles)
      .set({ statsPrivate: true })
      .where(eq(schema.profiles.userId, m.user.id));
    expect(await api(null).profile.stats({ username: m.username })).toBeNull();
    expect(await m.call().profile.stats({ username: m.username })).not.toBeNull();
  });
});

describe("stats cache", () => {
  const cacheOf = async (userId: string) =>
    (
      await handle.db
        .select()
        .from(schema.userStatsCache)
        .where(eq(schema.userStatsCache.userId, userId))
    )[0] ?? null;

  it("is reused, invalidated by listening writes, and renewed with the year", async () => {
    const m = await member();
    const stats = (at = now) => api(null, at).profile.stats({ username: m.username });
    await m.call().listening.entry.create(listen(release(nocturnes), "2026-10-01"));

    const first = await stats();
    expect(await cacheOf(m.user.id)).not.toBeNull();
    const later = new Date(now.getTime() + 60_000);
    expect((await stats(later))?.computedAt).toBe(first?.computedAt);

    const cachedVersion = (await cacheOf(m.user.id))?.statsVersion;
    await m.call().listening.quickLike({ target: release(leRoi), liked: true });
    expect((await readStatsMember(handle.db, m.user.id))?.statsVersion).toBeGreaterThan(
      cachedVersion!,
    );
    expect((await stats(later))?.base.listenedTotal.album).toBe(2);

    const newYear = new Date("2027-01-01T12:00:00Z");
    const renewed = await stats(newYear);
    expect(renewed?.base.year).toBe(2027);
    expect(renewed?.base.listenedThisYear.album).toBe(0);
  });

  it("recomputes after a read that raced a listening write", async () => {
    const m = await member();
    await m.call().listening.entry.create(listen(release(nocturnes), "2026-10-01"));
    // A slow reader reads the version and computes from the old listens...
    const before = await readStatsMember(handle.db, m.user.id);
    const stale = await computeStats(handle.db, m.user.id, 2026);
    // ...meanwhile a listen is written...
    await m.call().listening.entry.create(listen(release(leRoi), "2026-10-02"));
    // ...and the reader stores its result after the write committed.
    await storeStats(handle.db, m.user.id, before!.statsVersion, stale, now);

    const stats = await getMemberStats(handle.db, m.user.id, now);
    expect(stats?.base.listenedTotal.album).toBe(2);
    // A reader still slower, holding an even older result, cannot replace the fresh cache.
    await storeStats(handle.db, m.user.id, before!.statsVersion, stale, now);
    expect((await getMemberStats(handle.db, m.user.id, now))?.base.listenedTotal.album).toBe(2);
    expect((await cacheOf(m.user.id))?.statsVersion).toBeGreaterThan(before!.statsVersion);
  });

  it("expires after a day (catalog data can be completed later)", async () => {
    const m = await member();
    const stats = (at: Date) => api(null, at).profile.stats({ username: m.username });
    const first = await stats(now);
    const sameDay = await stats(new Date(now.getTime() + 23 * 3600_000));
    expect(sameDay?.computedAt).toBe(first?.computedAt);
    const nextDay = await stats(new Date(now.getTime() + 25 * 3600_000));
    expect(nextDay?.computedAt).not.toBe(first?.computedAt);
  });
});

describe("stats performance", () => {
  it("stays fast for a member with a few thousand listens", async () => {
    const LISTENS = 5_000;
    const RELEASES = 800;
    const m = await member();
    const { artists, entries, genres, releaseArtists, releaseGenres, releases } = schema;
    const genreRows = await handle.db
      .insert(genres)
      .values(Array.from({ length: 30 }, (_, i) => ({ slug: `perf-g${i}`, name: `Perf ${i}` })))
      .returning({ id: genres.id });
    const artistRows = await handle.db
      .insert(artists)
      .values(Array.from({ length: 200 }, (_, i) => ({ slug: `perf-a${i}`, name: `Perf ${i}` })))
      .returning({ id: artists.id });
    const types = ["album", "ep", "single"] as const;
    const releaseRows = await handle.db
      .insert(releases)
      .values(
        Array.from({ length: RELEASES }, (_, i) => ({
          slug: `perf-r${i}`,
          title: `Perf ${i}`,
          type: types[i % 3]!,
          releaseDate: `${1950 + (i % 76)}-06-01`,
        })),
      )
      .returning({ id: releases.id });
    await handle.db.insert(releaseArtists).values(
      releaseRows.map((r, i) => ({
        releaseId: r.id,
        artistId: artistRows[i % artistRows.length]!.id,
        position: 1,
      })),
    );
    await handle.db.insert(releaseGenres).values(
      releaseRows.flatMap((r, i) => [
        { releaseId: r.id, genreId: genreRows[i % 30]!.id },
        { releaseId: r.id, genreId: genreRows[(i + 7) % 30]!.id },
      ]),
    );
    const rows = Array.from({ length: LISTENS }, (_, i) => {
      const day = new Date(Date.UTC(2023, 0, 1) + (i % 1390) * 86_400_000);
      return {
        userId: m.user.id,
        releaseId: releaseRows[i % RELEASES]!.id,
        listenedOn: day.toISOString().slice(0, 10),
        rating: (i % 10) + 1,
        isRelisten: i >= RELEASES,
      };
    });
    for (let i = 0; i < rows.length; i += 1000) {
      await handle.db.insert(entries).values(rows.slice(i, i + 1000));
    }
    await handle.db.insert(schema.userItemState).values(
      releaseRows.map((r, i) => ({
        userId: m.user.id,
        releaseId: r.id,
        rating: (i % 10) + 1,
        listened: true,
      })),
    );

    const started = performance.now();
    const base = await computeBaseStats(handle.db, m.user.id, 2026);
    const computeMs = performance.now() - started;
    expect(base.listenedTotal.album + base.listenedTotal.ep + base.listenedTotal.single).toBe(
      RELEASES,
    );
    expect(base.topArtists).toHaveLength(5);
    // Generous bounds: in-memory PGlite on a CI runner; real Postgres is much faster.
    expect(computeMs).toBeLessThan(3_000);

    await api(null).profile.stats({ username: m.username }); // fills the cache
    const cachedStart = performance.now();
    await api(null).profile.stats({ username: m.username });
    expect(performance.now() - cachedStart).toBeLessThan(200);

    const diaryStart = performance.now();
    const page = await api(null).profile.diary({ username: m.username, page: 50 });
    expect(page?.items).toHaveLength(DIARY_PAGE_SIZE);
    expect(performance.now() - diaryStart).toBeLessThan(1_000);
  }, 60_000);

  it("reads a member's listens through the (user_id, listened_on) index", async () => {
    // PGlite plans with default statistics: forbid sequential scans to check the index fits.
    const plan = await handle.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      return tx.execute(sql`
        explain select count(*) from ${schema.entries}
        where ${schema.entries.userId} = ${fixtureId(1)}
          and ${schema.entries.listenedOn} >= '2026-01-01'
          and ${schema.entries.listenedOn} < '2027-01-01'
      `);
    });
    const text = JSON.stringify(plan);
    expect(text).toContain("entries_user_listened_idx");
  });
});
