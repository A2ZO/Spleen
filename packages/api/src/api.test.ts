import { describe, expect, it } from "vitest";

import { buildListenLinks } from "./lib/listen-links";
import { averageFromDistribution } from "./lib/ratings";
import { computeBaseStats, type StatsInput } from "./lib/stats";
import { createCaller } from "./root";

const caller = createCaller({ now: new Date("2026-10-20T12:00:00Z") });

describe("discover.home", () => {
  it("splits trending charts by audience language and sorts them", async () => {
    const feed = await caller.discover.home();
    expect(feed.trending.fr[0]?.slug).toBe("beton-velours");
    expect(feed.trending.en[0]?.slug).toBe("brass-and-bone");
    expect(feed.recent[0]?.slug).toBe("midnight-blue-avenue");
    expect(feed.popularReviews).toHaveLength(3);
  });
});

describe("release.bySlug", () => {
  it("returns a full release with ratings, reviews and listen links", async () => {
    const release = await caller.release.bySlug({ slug: "nocturnes-pour-pluie-fine" });
    expect(release).not.toBeNull();
    expect(release?.artists).toEqual([{ slug: "lune-basse", name: "Lune Basse" }]);
    expect(release?.tracks).toHaveLength(7);
    expect(release?.ratingCount).toBe(286);
    expect(release?.averageRating).toBeGreaterThan(7);
    expect(release?.reviews.map((r) => r.author.username)).toContain("rainydaysam");
    expect(release?.listenLinks.map((l) => l.service)).toEqual([
      "spotify",
      "deezer",
      "appleMusic",
      "youtube",
    ]);
  });

  it("returns null for an unknown slug", async () => {
    expect(await caller.release.bySlug({ slug: "does-not-exist" })).toBeNull();
  });

  it("rejects malformed slugs", async () => {
    await expect(caller.release.bySlug({ slug: "Not A Slug" })).rejects.toThrow();
  });
});

describe("profile.byUsername", () => {
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
    { listenedOn: "2026-03-01", rating: 6, release: a },
    { listenedOn: "2026-05-01", rating: 10, release: a },
    { listenedOn: "2025-12-01", rating: 4, release: b },
  ];

  it("counts distinct releases per year and in total", () => {
    const stats = computeBaseStats(entries, 2026);
    expect(stats.listenedThisYear).toEqual({ album: 1, ep: 0, single: 0 });
    expect(stats.listenedTotal).toEqual({ album: 1, ep: 1, single: 0 });
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
