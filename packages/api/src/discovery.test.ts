import { randomUUID } from "node:crypto";

import { eq, recomputeItemState, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { topRatedSchema } from "@spleen/validators";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { REFRESH_BATCH, artistsToRefresh } from "./lib/catalog/refresh";
import {
  DISCOVERY_MIN_RATINGS,
  RECENT_PAGE_SIZE,
  TREND_MIN_FILLED,
  bayesianScore,
} from "./lib/discovery";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/*
 * Discovery charts on an empty database. Charts are global, so each test lives in its own
 * period of time (`era`) or its own genre: tests never see each other's listens.
 */

let handle: DbHandle;
const DAY = 24 * 60 * 60 * 1000;
let eraCount = 0;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

/** A moment far from every other test's (1 000 days apart). */
function era() {
  eraCount += 1;
  const now = new Date(Date.UTC(2030, 0, 1) + eraCount * 1000 * DAY);
  return { now, ago: (days: number) => new Date(now.getTime() - days * DAY) };
}

const api = (now: Date, user: SessionUser | null = null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));

const short = () => randomUUID().slice(0, 8);

async function member(
  locale: "fr" | "en",
  options: { diaryPrivate?: boolean; blindMode?: boolean } = {},
) {
  const username = `d${short()}`;
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  await handle.db.insert(schema.profiles).values({
    userId: row!.id,
    username,
    displayName: username,
    locale,
    diaryPrivate: options.diaryPrivate ?? false,
    blindMode: options.blindMode ?? false,
    ageConfirmedAt: new Date(),
  });
  return { id: row!.id, email: row!.email };
}

async function artist(mbid: string | null = randomUUID()) {
  const [row] = await handle.db
    .insert(schema.artists)
    .values({ slug: `artist-${short()}`, name: `Artist ${short()}`, mbid })
    .returning();
  return row!;
}

async function release(
  options: {
    type?: "album" | "ep" | "single";
    date?: string | null;
    precision?: "year" | "month" | "day";
    secondaryTypes?: string[];
    genre?: string;
    artistId?: string;
  } = {},
) {
  const [row] = await handle.db
    .insert(schema.releases)
    .values({
      slug: `release-${short()}`,
      title: `Release ${short()}`,
      type: options.type ?? "album",
      releaseDate: options.date ?? null,
      releaseDatePrecision: options.date ? (options.precision ?? "day") : null,
      secondaryTypes: options.secondaryTypes ?? [],
    })
    .returning();
  if (options.genre) {
    const [genre] = await handle.db
      .insert(schema.genres)
      .values({ slug: options.genre, name: options.genre })
      .onConflictDoUpdate({ target: schema.genres.slug, set: { name: options.genre } })
      .returning();
    await handle.db.insert(schema.releaseGenres).values({ releaseId: row!.id, genreId: genre!.id });
  }
  if (options.artistId) {
    await handle.db
      .insert(schema.releaseArtists)
      .values({ releaseId: row!.id, artistId: options.artistId, position: 1 });
  }
  return row!.id;
}

/** A listen logged at `at`: dated (listened that day, or `listenedOn`) or undated. */
async function listen(
  user: { id: string },
  target: { releaseId: string } | { trackId: string } | { artistId: string },
  at: Date,
  options: { undated?: boolean; listenedOn?: string; rating?: number; liked?: boolean } = {},
) {
  await handle.db.insert(schema.entries).values({
    userId: user.id,
    ...target,
    listenedOn: options.undated ? null : (options.listenedOn ?? at.toISOString().slice(0, 10)),
    rating: options.rating ?? null,
    liked: options.liked ?? false,
    createdAt: at,
    updatedAt: at,
  });
  // Artist listens have no per-member state (ratings live on releases and tracks).
  if (!("artistId" in target)) await recomputeItemState(handle.db, user.id, target);
}

async function rate(releaseId: string, ratings: number[]) {
  for (const rating of ratings) {
    await listen(await member("fr"), { releaseId }, new Date(), { undated: true, rating });
  }
}

const ids = (items: { release: { id: string } }[]) => items.map((i) => i.release.id);

describe("weekly trends", () => {
  it("split by the interface language of the members who listen", async () => {
    const { now, ago } = era();
    const [fr1, fr2, en1, en2] = [
      await member("fr"),
      await member("fr"),
      await member("en"),
      await member("en"),
    ];
    const [french, english] = [await release(), await release()];
    for (const m of [fr1, fr2]) await listen(m, { releaseId: french }, ago(1));
    for (const m of [en1, en2]) await listen(m, { releaseId: english }, ago(2));

    const fr = await api(now).discovery.trends({ lang: "fr" });
    expect(fr[0]).toMatchObject({ release: { id: french }, listeners: 2, source: "lang" });
    expect(fr.filter((i) => i.source === "lang").map((i) => i.release.id)).toEqual([french]);
    const en = await api(now).discovery.trends({ lang: "en" });
    expect(en.filter((i) => i.source === "lang").map((i) => i.release.id)).toEqual([english]);
  });

  it("need two distinct members, and leave out private diaries", async () => {
    const { now, ago } = era();
    const [a, b, hidden] = [
      await member("fr"),
      await member("fr"),
      await member("fr", { diaryPrivate: true }),
    ];
    const [alone, twice, withPrivate, counted] = [
      await release(),
      await release(),
      await release(),
      await release(),
    ];
    await listen(a, { releaseId: alone }, ago(1));
    await listen(a, { releaseId: twice }, ago(1));
    await listen(a, { releaseId: twice }, ago(2));
    await listen(a, { releaseId: withPrivate }, ago(1));
    await listen(hidden, { releaseId: withPrivate }, ago(1));
    await listen(a, { releaseId: counted }, ago(1));
    await listen(b, { releaseId: counted }, ago(3));

    const trends = await api(now).discovery.trends({ lang: "fr" });
    expect(ids(trends)).toEqual([counted]);
  });

  it("count listens by when they were logged, undated ones included", async () => {
    const { now, ago } = era();
    const [a, b, c, d] = [
      await member("fr"),
      await member("fr"),
      await member("fr"),
      await member("fr"),
    ];
    const [old, quick, backdated] = [await release(), await release(), await release()];
    // Logged 8 days ago: out of the week.
    await listen(a, { releaseId: old }, ago(8));
    await listen(b, { releaseId: old }, ago(9));
    // Quick ratings (undated listens) this week.
    await listen(c, { releaseId: quick }, ago(1), { undated: true, rating: 8 });
    await listen(d, { releaseId: quick }, ago(2), { undated: true, liked: true });
    // Listened long ago, logged this week.
    await listen(a, { releaseId: backdated }, ago(1), { listenedOn: "2001-05-04" });
    await listen(b, { releaseId: backdated }, ago(2), { listenedOn: "2001-05-05" });

    const lang = (await api(now).discovery.trends({ lang: "fr" })).filter(
      (i) => i.source !== "month",
    );
    expect(ids(lang).sort()).toEqual([quick, backdated].sort());
    // Over 30 days, the older listens complete the chart.
    const all = await api(now).discovery.trends({ lang: "fr" });
    expect(all.find((i) => i.release.id === old)?.source).toBe("month");
  });

  it("complete a short chart with every language, then with the last 30 days", async () => {
    const { now, ago } = era();
    const fr = [await member("fr"), await member("fr")];
    const en = [await member("en"), await member("en")];
    const french = await release();
    const english = [await release(), await release()];
    const older = [await release(), await release(), await release()];
    for (const m of fr) await listen(m, { releaseId: french }, ago(1));
    for (const r of english) for (const m of en) await listen(m, { releaseId: r }, ago(2));
    for (const r of older) for (const m of en) await listen(m, { releaseId: r }, ago(20));

    const trends = await api(now).discovery.trends({ lang: "fr" });
    expect(trends.map((i) => i.source)).toEqual(["lang", "all", "all", "month", "month", "month"]);
    expect(trends[0]!.release.id).toBe(french);
    expect(new Set(ids(trends)).size).toBe(trends.length);
    expect(trends.length).toBeGreaterThanOrEqual(TREND_MIN_FILLED);
    // A shorter chart (the home page) stops completing once it is full.
    const short = await api(now).discovery.trends({ lang: "fr", size: 3 });
    expect(short.map((i) => i.source)).toEqual(["lang", "all", "all"]);
  });

  it("stop at the language chart when it is long enough", async () => {
    const { now, ago } = era();
    const fr = [await member("fr"), await member("fr")];
    const en = [await member("en"), await member("en")];
    for (let i = 0; i < TREND_MIN_FILLED; i += 1) {
      const r = await release();
      for (const m of fr) await listen(m, { releaseId: r }, ago(1));
    }
    const english = await release();
    for (const m of en) await listen(m, { releaseId: english }, ago(1));
    const trends = await api(now).discovery.trends({ lang: "fr" });
    expect(trends.every((i) => i.source === "lang")).toBe(true);
    expect(trends).toHaveLength(TREND_MIN_FILLED);
  });

  it("hide ratings from a blind viewer who has not rated", async () => {
    const { now, ago } = era();
    const fr = [await member("fr"), await member("fr")];
    const blind = await member("fr", { blindMode: true });
    const r = await release();
    for (const m of fr) await listen(m, { releaseId: r }, ago(1), { rating: 9 });
    const [seen] = await api(now, blind).discovery.trends({ lang: "fr" });
    expect(seen!.release).toMatchObject({ averageRating: null, ratingsHidden: true });
    const [open] = await api(now).discovery.trends({ lang: "fr" });
    expect(open!.release.averageRating).toBe(9);
  });
});

describe("recent releases", () => {
  it("list studio albums and EPs out in the last 90 days, newest first", async () => {
    const { now, ago } = era();
    const day = (n: number) => ago(n).toISOString().slice(0, 10);
    const newest = await release({ date: day(2) });
    const ep = await release({ type: "ep", date: day(30) });
    const monthOnly = await release({ date: day(60), precision: "month" });
    await release({ date: day(120) }); // too old
    await release({ date: day(-5) }); // announced, not out yet
    await release({ date: day(10), precision: "year" }); // year only: not really recent
    await release({ date: day(5), secondaryTypes: ["compilation"] });
    const single = await release({ type: "single", date: day(3) });

    const recent = await api(now).discovery.recent({});
    expect(recent.items.map((r) => r.id)).toEqual([newest, ep, monthOnly]);
    const singles = await api(now).discovery.recent({ type: "single" });
    expect(singles.items.map((r) => r.id)).toEqual([single]);
  });

  it("are paged", async () => {
    const { now, ago } = era();
    for (let i = 0; i < RECENT_PAGE_SIZE + 2; i += 1) {
      await release({
        date: ago(i + 1)
          .toISOString()
          .slice(0, 10),
      });
    }
    const second = await api(now).discovery.recent({ page: 2 });
    expect(second).toMatchObject({ page: 2, pageCount: 2, total: RECENT_PAGE_SIZE + 2 });
    expect(second.items).toHaveLength(2);
    const small = await api(now).discovery.recent({ size: 3 });
    expect(small.items).toHaveLength(3);
    expect(small.pageCount).toBe(Math.ceil((RECENT_PAGE_SIZE + 2) / 3));
  });
});

describe("top rated", () => {
  it("weigh averages toward the site average (Bayesian score)", () => {
    // One perfect rating barely moves a record; many good ones lift it.
    expect(bayesianScore(1, 10, 6, 3)).toBe(7);
    expect(bayesianScore(30, 9, 6, 3)).toBeCloseTo(8.73, 2);
    expect(bayesianScore(30, 9, 6, 3)).toBeGreaterThan(bayesianScore(3, 10, 6, 3));
  });

  it("need a minimum number of ratings and rank by Bayesian score", async () => {
    const { now } = era();
    const genre = `g${short()}`;
    const [perfectFew, greatMany, good, lonely] = [
      await release({ genre }),
      await release({ genre }),
      await release({ genre }),
      await release({ genre }),
    ];
    await rate(perfectFew, Array(DISCOVERY_MIN_RATINGS).fill(10));
    // 20 ratings averaging 9.9 beat 3 perfect ones: more evidence, closer to its average.
    await rate(greatMany, [...Array(18).fill(10), 9, 9]);
    await rate(good, Array(DISCOVERY_MIN_RATINGS).fill(6));
    await rate(lonely, Array(DISCOVERY_MIN_RATINGS - 1).fill(10));

    const chart = await api(now).discovery.topRated({ genre });
    expect(chart.items.map((i) => i.release.id)).toEqual([greatMany, perfectFew, good]);
    expect(chart.items.map((i) => i.rank)).toEqual([1, 2, 3]);
    const scores = chart.items.map((i) => i.score!);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    // The raw average stays on the card: 10 for the record behind on score.
    expect(chart.items[1]!.release.averageRating).toBe(10);
  });

  it("filter by genre, year, decade and type", async () => {
    const { now } = era();
    const genre = `g${short()}`;
    const other = `g${short()}`;
    const in1975 = await release({ genre, date: "1975-04-01" });
    const in1979 = await release({ genre, date: "1979-09-01" });
    const in1981 = await release({ genre, date: "1981-01-01" });
    const ep1975 = await release({ genre, type: "ep", date: "1975-06-01" });
    const elsewhere = await release({ genre: other, date: "1975-02-01" });
    for (const r of [in1975, in1979, in1981, ep1975, elsewhere]) {
      await rate(r, Array(DISCOVERY_MIN_RATINGS).fill(8));
    }
    const chart = async (input: Parameters<ReturnType<typeof api>["discovery"]["topRated"]>[0]) =>
      (await api(now).discovery.topRated(input)).items.map((i) => i.release.id).sort();

    expect(await chart({ genre })).toEqual([in1975, in1979, in1981].sort());
    expect(await chart({ genre, year: 1975 })).toEqual([in1975]);
    expect(await chart({ genre, decade: 1970 })).toEqual([in1975, in1979].sort());
    expect(await chart({ genre, decade: 1970, type: "ep" })).toEqual([ep1975]);
    expect(topRatedSchema.safeParse({ year: 1975, decade: 1970 }).success).toBe(false);
    expect(topRatedSchema.safeParse({ decade: 1975 }).success).toBe(false);
  });

  it("hide the score from a blind viewer until they rate", async () => {
    const { now } = era();
    const genre = `g${short()}`;
    const r = await release({ genre });
    await rate(r, Array(DISCOVERY_MIN_RATINGS).fill(7));
    const blind = await member("fr", { blindMode: true });
    const [hidden] = (await api(now, blind).discovery.topRated({ genre })).items;
    expect(hidden).toMatchObject({ score: null, release: { ratingsHidden: true } });
    await listen(blind, { releaseId: r }, new Date(), { undated: true, rating: 6 });
    const [shown] = (await api(now, blind).discovery.topRated({ genre })).items;
    expect(shown!.score).not.toBeNull();
  });

  it("offer the genres that have releases", async () => {
    const genre = `g${short()}`;
    await release({ genre });
    const genres = await api(new Date()).discovery.genres();
    expect(genres.map((g) => g.slug)).toContain(genre);
  });
});

describe("suspended members", () => {
  const suspend = (user: { id: string }, at: Date | null) =>
    handle.db
      .update(schema.profiles)
      .set({ suspendedAt: at, suspensionReason: at ? "Spam" : null })
      .where(eq(schema.profiles.userId, user.id));

  it("leave every public figure while suspended, and come back when it is lifted", async () => {
    const { now, ago } = era();
    const genre = `g${short()}`;
    const r = await release({ genre });
    const [row] = await handle.db
      .select({ slug: schema.releases.slug })
      .from(schema.releases)
      .where(eq(schema.releases.id, r));
    const fair = [await member("fr"), await member("fr"), await member("fr")];
    const spammer = await member("fr");
    for (const m of fair) await listen(m, { releaseId: r }, ago(1), { rating: 6 });
    await listen(spammer, { releaseId: r }, ago(1), { rating: 10 });

    const figures = async () => {
      const page = (await api(now).release.bySlug({ slug: row!.slug }))!;
      const trend = (await api(now).discovery.trends({ lang: "fr" })).find(
        (i) => i.release.id === r,
      );
      const [top] = (await api(now).discovery.topRated({ genre })).items;
      return {
        average: page.averageRating,
        count: page.ratingCount,
        tens: page.ratingDistribution[9],
        listeners: trend?.listeners,
        topAverage: top?.release.averageRating,
      };
    };
    const everyone = { average: 7, count: 4, tens: 1, listeners: 4, topAverage: 7 };
    expect(await figures()).toEqual(everyone);

    await suspend(spammer, now);
    expect(await figures()).toEqual({
      average: 6,
      count: 3,
      tens: 0,
      listeners: 3,
      topAverage: 6,
    });
    // Their own state is untouched: only public figures leave them out.
    const [state] = await handle.db
      .select({ rating: schema.userItemState.rating })
      .from(schema.userItemState)
      .where(eq(schema.userItemState.userId, spammer.id));
    expect(state!.rating).toBe(10);

    await suspend(spammer, null);
    expect(await figures()).toEqual(everyone);
  });

  it("can drop a record out of the top rated chart", async () => {
    const { now } = era();
    const genre = `g${short()}`;
    const r = await release({ genre });
    await rate(r, Array(DISCOVERY_MIN_RATINGS - 1).fill(9));
    const spammer = await member("fr");
    await listen(spammer, { releaseId: r }, new Date(), { undated: true, rating: 10 });
    expect((await api(now).discovery.topRated({ genre })).items).toHaveLength(1);
    await suspend(spammer, now);
    expect((await api(now).discovery.topRated({ genre })).items).toEqual([]);
  });
});

describe("discography refresh", () => {
  it("picks artists listened to in 30 days or on a Shelf, not refreshed this week", async () => {
    const { now, ago } = era();
    const [a, b] = [await member("fr"), await member("fr")];
    const popular = await artist();
    const viaTrack = await artist();
    const viaArtistListen = await artist();
    const shelved = await artist();
    const stale = await artist();
    const fresh = await artist();
    const noMbid = await artist(null);

    const popularRelease = await release({ artistId: popular.id });
    for (const m of [a, b]) await listen(m, { releaseId: popularRelease }, ago(3));
    const [track] = await handle.db
      .insert(schema.tracks)
      .values({ slug: `track-${short()}`, title: "Piste" })
      .returning();
    await handle.db
      .insert(schema.trackArtists)
      .values({ trackId: track!.id, artistId: viaTrack.id, position: 1 });
    await listen(a, { trackId: track!.id }, ago(10));
    await listen(a, { artistId: viaArtistListen.id }, ago(5));
    const shelf = await release({ artistId: shelved.id });
    await handle.db
      .insert(schema.favorites)
      .values({ userId: b.id, position: 1, releaseId: shelf });
    await listen(a, { releaseId: await release({ artistId: stale.id }) }, ago(40));
    await listen(a, { releaseId: await release({ artistId: fresh.id }) }, ago(2));
    await handle.db
      .update(schema.artists)
      .set({ discographyRefreshedAt: ago(2) })
      .where(eq(schema.artists.id, fresh.id));
    await listen(a, { releaseId: await release({ artistId: noMbid.id }) }, ago(2));

    const picked = await artistsToRefresh(handle.db, now);
    const mine = picked.filter((p) =>
      [popular, viaTrack, viaArtistListen, shelved, stale, fresh, noMbid].some(
        (x) => x.id === p.id,
      ),
    );
    expect(mine[0]).toMatchObject({ id: popular.id, listeners: 2 });
    expect(mine.map((p) => p.id).sort()).toEqual(
      [popular.id, viaTrack.id, viaArtistListen.id, shelved.id].sort(),
    );
    expect(mine.find((p) => p.id === shelved.id)).toMatchObject({ listeners: 0, shelves: 1 });
    expect(picked.length).toBeLessThanOrEqual(REFRESH_BATCH);
    expect(await artistsToRefresh(handle.db, now, 1)).toHaveLength(1);
  });
});
