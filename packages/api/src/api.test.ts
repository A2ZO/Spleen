import { createDb, seed, type DbHandle } from "@spleen/db";
import { loadMessages, locales } from "@spleen/i18n";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API_ERROR_CODES } from "./errors";
import { buildListenLinks } from "./lib/listen-links";
import { averageFromDistribution } from "./lib/ratings";
import { computeBaseStats, type StatsInput } from "./lib/stats";
import { createCaller } from "./root";
import { createContext } from "./trpc";

const now = new Date("2026-10-20T12:00:00Z");
const caller = createCaller(
  createContext({
    now,
    db: () => {
      throw new Error("fixture-backed procedures must not open the database");
    },
  }),
);

describe("system.health", () => {
  it("queries the database", async () => {
    const handle = createDb("memory://");
    try {
      await handle.migrate();
      const health = createCaller(createContext({ db: () => handle.db })).system.health();
      expect(await health).toEqual({ ok: true, releases: 0 });
    } finally {
      await handle.close();
    }
  }, 60_000);
});

describe("discover.home", () => {
  it("splits trending charts by audience language and sorts them", async () => {
    const feed = await caller.discover.home();
    expect(feed.trending.fr[0]?.slug).toBe("beton-velours");
    expect(feed.trending.en[0]?.slug).toBe("brass-and-bone");
    expect(feed.recent[0]?.slug).toBe("midnight-blue-avenue");
    expect(feed.popularReviews).toHaveLength(3);
  });
});

describe("profile.byUsername", () => {
  let handle: DbHandle;
  let caller: ReturnType<typeof createCaller>;
  beforeAll(async () => {
    handle = createDb("memory://");
    await handle.migrate();
    await seed(handle.db);
    caller = createCaller(createContext({ now, db: () => handle.db }));
  }, 60_000);
  afterAll(() => handle.close());

  it("returns a profile with a 4-slot shelf and stats", async () => {
    const profile = await caller.profile.byUsername({ username: "NuitBlanche" });
    expect(profile?.shelf).toHaveLength(4);
    expect(profile?.shelf.every(Boolean)).toBe(true);
    expect(profile?.recent).toHaveLength(5);
    expect(profile?.diary[0]?.listenedOn).toBe("2026-10-18");
    expect(profile?.stats.year).toBe(2026);
  });

  it("fills empty shelf slots with null", async () => {
    const profile = await caller.profile.byUsername({ username: "rainydaysam" });
    expect(profile?.shelf).toEqual([null, null, null, null]);
  });

  it("returns null for an unknown member", async () => {
    expect(await caller.profile.byUsername({ username: "nobody_here" })).toBeNull();
  });
});

describe("averageFromDistribution", () => {
  it("computes a weighted mean on the 1..10 scale", () => {
    expect(averageFromDistribution([0, 0, 0, 0, 0, 0, 0, 0, 0, 2])).toBe(10);
    expect(averageFromDistribution([1, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe(5.5);
    expect(averageFromDistribution(Array(10).fill(0))).toBeNull();
  });
});

describe("buildListenLinks", () => {
  it("builds encoded search URLs", () => {
    const [spotify] = buildListenLinks("Café crème", ["Quartet Sépia"]);
    expect(spotify?.url).toBe(
      "https://open.spotify.com/search/Quartet%20S%C3%A9pia%20Caf%C3%A9%20cr%C3%A8me",
    );
  });
});

describe("computeBaseStats", () => {
  const release = (id: string, type: "album" | "ep" | "single", year: number, artist: string) => ({
    id,
    type,
    releaseYear: year,
    genres: ["Jazz"],
    artists: [{ slug: artist, name: artist }],
  });
  const a = release("a", "album", 1959, "miles");
  const b = release("b", "ep", 2024, "kassim");
  const entries: StatsInput[] = [
    { listenedOn: "2026-03-01", editedAt: "2026-03-01T21:00:00Z", rating: 6, release: a },
    { listenedOn: "2026-05-01", editedAt: "2026-05-01T21:00:00Z", rating: 10, release: a },
    { listenedOn: "2025-12-01", editedAt: "2025-12-01T21:00:00Z", rating: 4, release: b },
  ];

  it("counts distinct releases per year and in total", () => {
    const stats = computeBaseStats(entries, 2026);
    expect(stats.listenedThisYear).toEqual({ album: 1, ep: 0, single: 0 });
    expect(stats.listenedTotal).toEqual({ album: 1, ep: 1, single: 0 });
  });

  it("counts undated listens in all-time totals only", () => {
    const undated: StatsInput = {
      listenedOn: null,
      editedAt: "2026-06-01T21:00:00Z",
      rating: 8,
      release: release("c", "single", 2001, "nora"),
    };
    const stats = computeBaseStats([...entries, undated], 2026);
    expect(stats.listenedTotal).toEqual({ album: 1, ep: 1, single: 1 });
    expect(stats.listenedThisYear).toEqual({ album: 1, ep: 0, single: 0 });
    expect(stats.activityByMonth.reduce((a, b) => a + b, 0)).toBe(2);
    expect(stats.topArtists.map((a) => a.slug)).toEqual(["miles"]);
  });

  it("uses the most recently edited rating per release for the distribution", () => {
    const reRated: StatsInput = { ...entries[0]!, editedAt: "2026-06-01T21:00:00Z" };
    const stats = computeBaseStats([reRated, entries[1]!, entries[2]!], 2026);
    expect(stats.ratingDistribution[5]).toBe(1);
    expect(stats.ratingDistribution[9]).toBe(0);
  });

  it("uses the latest rating per release for the distribution", () => {
    const stats = computeBaseStats(entries, 2026);
    expect(stats.ratingDistribution[9]).toBe(1);
    expect(stats.ratingDistribution[5]).toBe(0);
    expect(stats.ratingDistribution[3]).toBe(1);
  });

  it("aggregates top artists, decades and monthly activity", () => {
    const stats = computeBaseStats(entries, 2026);
    expect(stats.topArtists).toEqual([{ slug: "miles", name: "miles", count: 2 }]);
    expect(stats.decades).toEqual([
      { decade: 1950, count: 2 },
      { decade: 2020, count: 1 },
    ]);
    expect(stats.activityByMonth[2]).toBe(1);
    expect(stats.activityByMonth[4]).toBe(1);
  });
});

describe("error codes", () => {
  it("all have a message in both languages", async () => {
    for (const locale of locales) {
      const messages = await loadMessages(locale);
      for (const code of API_ERROR_CODES) expect(messages.errors[code]).toBeTruthy();
    }
  });
});
