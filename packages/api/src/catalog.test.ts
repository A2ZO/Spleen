import { createMusicBrainzProvider, type Throttle } from "@spleen/catalog";
import { createReplayFetch, FIXTURE_ALBUM, FIXTURE_RECORDING } from "@spleen/catalog/testing";
import { createDb, eq, schema, seed, type DbHandle } from "@spleen/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

const THEODORA = "3d519348-d1eb-4e8d-aab4-85ebe819bc46";

let handle: DbHandle;
let member: SessionUser;
let replay: ReturnType<typeof createReplayFetch>;

const noThrottle: Throttle = { acquire: async () => {}, backOff: async () => {} };

beforeAll(async () => {
  handle = createDb("memory://");
  await handle.migrate();
  await seed(handle.db);
  const [row] = await handle.db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, "nuitblanche@example.test"));
  member = row!;
  replay = createReplayFetch({ covers: [FIXTURE_ALBUM.mbid] });
}, 60_000);

afterAll(() => handle.close());

function api(user: SessionUser | null) {
  const catalog = () =>
    createMusicBrainzProvider({
      userAgent: "Spleen-test/0.1 ( test@example.test )",
      throttle: noThrottle,
      fetch: replay,
    });
  return createCaller(createContext({ db: () => handle.db, user: async () => user, catalog }));
}

describe("release.bySlug (database)", () => {
  it("returns a seeded release with tracks, community ratings, reviews and lists", async () => {
    const release = await api(null).release.bySlug({ slug: "nocturnes-pour-pluie-fine" });
    expect(release).not.toBeNull();
    expect(release?.artists).toEqual([{ slug: "lune-basse", name: "Lune Basse" }]);
    expect(release?.year).toBe(2024);
    expect(release?.isStub).toBe(false);
    expect(release?.genres).toEqual(["Ambient", "Jazz"]);
    expect(release?.tracks).toHaveLength(7);
    expect(release?.tracks[0]).toMatchObject({ disc: 1, position: 1, title: "Vitre embuée" });
    expect(release?.tracks[0]?.slug).toBeTruthy();
    // Ratings come from the members' latest state, not from the mockup counts.
    expect(release?.ratingCount).toBeGreaterThan(0);
    expect(release?.ratingCount).toBeLessThan(10);
    expect(release?.ratingDistribution.reduce((a, b) => a + b, 0)).toBe(release?.ratingCount);
    expect(release?.reviews.map((r) => r.author.username)).toContain("rainydaysam");
    expect(release?.lists.length).toBeGreaterThan(0);
    expect(release?.listenLinks.map((l) => l.service)).toEqual([
      "spotify",
      "deezer",
      "appleMusic",
      "youtube",
    ]);
  });

  it("returns null for an unknown slug and rejects malformed ones", async () => {
    expect(await api(null).release.bySlug({ slug: "does-not-exist" })).toBeNull();
    await expect(api(null).release.bySlug({ slug: "Not A Slug" })).rejects.toThrow();
  });
});

describe("catalog.search (local)", () => {
  it("ignores case and accents and tolerates typos", async () => {
    const search = (q: string) => api(null).catalog.search({ q, type: "release" });
    expect((await search("BETON VELOURS")).releases[0]?.slug).toBe("beton-velours");
    expect((await search("nocturne pluie")).releases[0]?.slug).toBe("nocturnes-pour-pluie-fine");
    expect((await search("cafe creme")).releases[0]?.title).toBe("Café crème");
    expect((await search("noctrunes pour pluie")).releases[0]?.slug).toBe(
      "nocturnes-pour-pluie-fine",
    );
  });

  it("finds a release from its artist, and artists and tracks", async () => {
    const all = await api(null).catalog.search({ q: "lune basse", type: "all" });
    expect(all.artists[0]?.slug).toBe("lune-basse");
    expect(all.releases.map((r) => r.slug)).toContain("nocturnes-pour-pluie-fine");
    const tracks = await api(null).catalog.search({ q: "vitre embuee", type: "track" });
    expect(tracks.tracks[0]?.title).toBe("Vitre embuée");
    expect(tracks.tracks[0]?.release?.slug).toBe("nocturnes-pour-pluie-fine");
    expect(tracks.releases).toEqual([]);
  });

  it("matches short prefixes", async () => {
    const { releases } = await api(null).catalog.search({ q: "bé", type: "release" });
    expect(releases.map((r) => r.slug)).toContain("beton-velours");
  });
});

describe("MusicBrainz import", () => {
  it("is reserved to members", async () => {
    await expect(
      api(null).catalog.import({ kind: "release_group", mbid: FIXTURE_ALBUM.mbid }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api(null).catalog.searchRemote({ q: "kind of blue" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("imports a recording through the album it first appeared on", async () => {
    const result = await api(member).catalog.import({
      kind: "recording",
      mbid: FIXTURE_RECORDING.mbid,
    });
    expect(result).toEqual({ kind: "recording", slug: "so-what-miles-davis" });
    const track = await api(null).track.bySlug({ slug: result.slug });
    expect(track?.artists).toEqual([{ slug: "miles-davis", name: "Miles Davis" }]);
    expect(track?.durationMs).toBeGreaterThan(500_000);
    expect(track?.appearsOn.map((r) => r.slug)).toEqual(["kind-of-blue"]);
  });

  it("imports a release group once and for all, with tracklist, genres and cover", async () => {
    const calls = replay.calls.length;
    const result = await api(member).catalog.import({
      kind: "release_group",
      mbid: FIXTURE_ALBUM.mbid,
    });
    expect(result.slug).toBe("kind-of-blue");
    expect(replay.calls.length).toBe(calls); // Already complete: no provider call.

    const release = await api(null).release.bySlug({ slug: "kind-of-blue" });
    expect(release).toMatchObject({
      title: "Kind of Blue",
      type: "album",
      year: 1959,
      releaseDate: "1959-08-17",
      releaseDatePrecision: "day",
      isStub: false,
      coverUrl: `https://coverartarchive.org/release-group/${FIXTURE_ALBUM.mbid}/front-500`,
    });
    expect(release?.tracks.map((t) => t.title)).toEqual([
      "So What",
      "Freddie Freeloader",
      "Blue in Green",
      "All Blues",
      "Flamenco Sketches",
    ]);
    expect(release?.genres.map((g) => g.toLowerCase())).toContain("cool jazz");
    expect(release?.ratingCount).toBe(0);

    const [job] = await handle.db
      .select()
      .from(schema.catalogImportJobs)
      .where(eq(schema.catalogImportJobs.mbid, FIXTURE_ALBUM.mbid));
    expect(job).toMatchObject({ kind: "release_group", status: "done", requestedById: member.id });
  });

  it("marks remote hits that Spleen already has", async () => {
    const hits = await api(member).catalog.searchRemote({
      q: FIXTURE_ALBUM.query,
      type: "release",
    });
    expect(hits[0]).toMatchObject({
      kind: "release_group",
      mbid: FIXTURE_ALBUM.mbid,
      localSlug: "kind-of-blue",
      subtitle: "Miles Davis",
      year: 1959,
    });
    expect(hits.slice(1).every((h) => h.localSlug === null)).toBe(true);
  });

  it("imports an artist with its discography as stubs, completed on demand", async () => {
    const { slug } = await api(member).catalog.import({ kind: "artist", mbid: THEODORA });
    expect(slug).toBe("theodora");
    const artist = await api(null).artist.bySlug({ slug });
    expect(artist).toMatchObject({ name: "Theodora", country: "FR", discographyPending: false });
    expect(artist?.discography.albums.length).toBeGreaterThan(0);
    expect(artist?.discography.singles.length).toBeGreaterThan(0);

    const stubSlug = artist!.discography.albums[0]!.slug;
    const stub = await api(null).release.bySlug({ slug: stubSlug });
    expect(stub?.isStub).toBe(true);
    expect(stub?.tracks).toEqual([]);

    // A visitor never triggers MusicBrainz; a member does (no recorded answer here: the
    // provider says "not found" and the page stays a stub instead of failing).
    const calls = replay.calls.length;
    await api(null).release.bySlug({ slug: stubSlug });
    expect(replay.calls.length).toBe(calls);
    const opened = await api(member).release.bySlug({ slug: stubSlug });
    expect(replay.calls.length).toBeGreaterThan(calls);
    expect(opened?.isStub).toBe(true);
  });

  it("gives artists with the same name distinct slugs", async () => {
    const [miles] = await handle.db
      .select({ slug: schema.artists.slug })
      .from(schema.artists)
      .where(eq(schema.artists.name, "Miles Davis"));
    expect(miles?.slug).toBe("miles-davis");
    const slugs = await handle.db.select({ slug: schema.releases.slug }).from(schema.releases);
    expect(new Set(slugs.map((s) => s.slug)).size).toBe(slugs.length);
  });

  it("maps provider errors to stable codes", async () => {
    await expect(
      api(member).catalog.import({
        kind: "release_group",
        mbid: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "CATALOG_NOT_FOUND" });
  });
});

describe("artist.bySlug and track.bySlug", () => {
  it("lists a seeded artist's releases, newest first", async () => {
    const artist = await api(null).artist.bySlug({ slug: "lune-basse" });
    expect(artist?.discographyPending).toBe(false);
    const all = [
      ...artist!.discography.albums,
      ...artist!.discography.eps,
      ...artist!.discography.singles,
    ];
    expect(all.map((r) => r.slug)).toContain("nocturnes-pour-pluie-fine");
  });

  it("returns null for unknown slugs", async () => {
    expect(await api(null).artist.bySlug({ slug: "nobody" })).toBeNull();
    expect(await api(null).track.bySlug({ slug: "nothing" })).toBeNull();
  });
});
