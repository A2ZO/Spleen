import { randomUUID } from "node:crypto";

import {
  CatalogError,
  createMusicBrainzProvider,
  type CatalogProvider,
  type EditionLinks,
  type ProviderArtist,
  type Throttle,
} from "@spleen/catalog";
import { createReplayFetch, FIXTURE_STREAMING_ALBUM } from "@spleen/catalog/testing";
import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  artistsForLinks,
  refreshListenLinks,
  releasesForLinks,
} from "./lib/catalog/listen-links-refresh";

/* Nightly re-read of the "Listen on" links (docs/catalogue.md): queues, caps, replacement. */

const now = new Date("2026-11-17T03:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const noThrottle: Throttle = { acquire: async () => {}, backOff: async () => {} };
const { artists, listenLinks, releases, tracks } = schema;

let handle: DbHandle;
const db = () => handle.db;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);
afterAll(() => handle.close());
beforeEach(async () => {
  await db().delete(listenLinks);
  await db().delete(tracks);
  await db().delete(releases);
  await db().delete(artists);
});

let counter = 0;
async function release(values: Partial<typeof releases.$inferInsert> = {}) {
  const [row] = await db()
    .insert(releases)
    .values({
      slug: `r-${++counter}`,
      title: `Release ${counter}`,
      type: "album",
      mbid: randomUUID(),
      tracklistImportedAt: daysAgo(100),
      ...values,
    })
    .returning();
  return row!;
}

async function artist(values: Partial<typeof artists.$inferInsert> = {}) {
  const [row] = await db()
    .insert(artists)
    .values({
      slug: `a-${++counter}`,
      name: `Artist ${counter}`,
      mbid: randomUUID(),
      discographyImportedAt: daysAgo(100),
      ...values,
    })
    .returning();
  return row!;
}

async function linksOf(column: "releaseId" | "trackId" | "artistId", id: string) {
  const rows = await db()
    .select({ service: listenLinks.service, url: listenLinks.url })
    .from(listenLinks)
    .where(eq(listenLinks[column], id));
  return Object.fromEntries(rows.map((r) => [r.service, r.url]));
}

const checkedAt = async (table: typeof releases | typeof artists, id: string) => {
  const [row] = await db()
    .select({ at: table.linksCheckedAt })
    .from(table as typeof releases)
    .where(eq(table.id, id));
  return row?.at ?? null;
};

const spotify = (id: string) => ({
  type: "free streaming",
  url: `https://open.spotify.com/album/${id}`,
});
const deezer = (id: string) => ({
  type: "free streaming",
  url: `https://www.deezer.com/album/${id}`,
});
const edition = (mbid: string, urlRelations: { type: string; url: string }[]) => ({
  mbid,
  title: "Edition",
  status: "official",
  date: { date: "2020-01-01", precision: "day" as const },
  country: "XW",
  urlRelations,
});

/** A provider answering from maps; unknown ids are `not_found`. */
function fakeProvider(
  editions: Record<string, EditionLinks | Error> = {},
  people: Record<string, ProviderArtist | Error> = {},
  calls: string[] = [],
): CatalogProvider {
  const answer = <T>(value: T | Error | undefined, mbid: string): T => {
    calls.push(mbid);
    if (value === undefined) throw new CatalogError("not_found", "gone");
    if (value instanceof Error) throw value;
    return value;
  };
  return {
    getEditionLinks: async (mbid: string) => answer(editions[mbid], mbid),
    getArtist: async (mbid: string) => answer(people[mbid], mbid),
  } as unknown as CatalogProvider;
}

describe("queues", () => {
  it("takes never read records first (latest completed first), then stale ones, oldest first", async () => {
    const neverOld = await release({ tracklistImportedAt: daysAgo(20) });
    const neverNew = await release({ tracklistImportedAt: daysAgo(2) });
    const stale = await release({ linksCheckedAt: daysAgo(40) });
    const staleOlder = await release({ linksCheckedAt: daysAgo(60) });
    await release({ linksCheckedAt: daysAgo(10) });
    await release({ tracklistImportedAt: null });
    await release({ mbid: null });
    const kept = await release();
    await release({ mergedIntoId: kept.id });

    expect((await releasesForLinks(db(), now)).map((r) => r.id)).toEqual([
      neverNew.id,
      neverOld.id,
      kept.id,
      staleOlder.id,
      stale.id,
    ]);
    expect((await releasesForLinks(db(), now, 2)).map((r) => r.id)).toEqual([
      neverNew.id,
      neverOld.id,
    ]);
  });

  it("takes artists with an imported discography, same order", async () => {
    const never = await artist({ discographyImportedAt: daysAgo(5) });
    const stale = await artist({ linksCheckedAt: daysAgo(31) });
    await artist({ discographyImportedAt: null });
    await artist({ linksCheckedAt: daysAgo(3) });
    const kept = await artist({ discographyImportedAt: daysAgo(50) });
    await artist({ mergedIntoId: kept.id });

    expect((await artistsForLinks(db(), now)).map((a) => a.id)).toEqual([
      never.id,
      kept.id,
      stale.id,
    ]);
    expect(await artistsForLinks(db(), now, 1)).toHaveLength(1);
  });
});

describe("refreshListenLinks", () => {
  it("chooses per service along the ranked editions and replaces the record's links", async () => {
    const brat = await release({ mbid: FIXTURE_STREAMING_ALBUM.mbid });
    await db()
      .insert(listenLinks)
      .values([
        {
          releaseId: brat.id,
          service: "spotify",
          url: "https://open.spotify.com/album/0000000000000000000000",
        },
        { releaseId: brat.id, service: "bandcamp", url: "https://gone.bandcamp.com/album/brat" },
      ]);
    const [track] = await db().insert(tracks).values({ slug: "t-brat", title: "360" }).returning();
    const trackUrl = "https://open.spotify.com/track/0000000000000000000000";
    await db()
      .insert(listenLinks)
      .values({ trackId: track!.id, service: "spotify", url: trackUrl });

    const replay = createMusicBrainzProvider({
      userAgent: "Spleen-test/0.1 ( test@example.test )",
      throttle: noThrottle,
      fetch: createReplayFetch(),
    });
    const result = await refreshListenLinks(db(), replay, { now });

    const links = await linksOf("releaseId", brat.id);
    // The reference edition (official, earliest, worldwide) wins for Spotify.
    expect(links.spotify).toBe("https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7");
    expect(links.deezer).toMatch(/^https:\/\/www\.deezer\.com\/album\/\d+$/);
    expect(links.apple_music).toMatch(/^https:\/\/music\.apple\.com\/[a-z]{2}\/album\/\d+$/);
    expect(links.bandcamp).toBeUndefined();
    expect(await checkedAt(releases, brat.id)).toEqual(now);
    expect(await linksOf("trackId", track!.id)).toEqual({ spotify: trackUrl });
    expect(result).toMatchObject({ releases: 1, artists: 0, failed: 0, deferred: 0 });
    expect(result.links).toBe(Object.keys(links).length);
  });

  it("follows the edition ranking, not the answer's order", async () => {
    const record = await release();
    const provider = fakeProvider({
      [record.mbid!]: {
        total: 2,
        editions: [
          {
            ...edition("b", [spotify("B".repeat(22))]),
            date: { date: "2021-01-01", precision: "day" },
          },
          edition("a", [spotify("A".repeat(22))]),
        ],
      },
    });
    await refreshListenLinks(db(), provider, { now });
    expect((await linksOf("releaseId", record.id)).spotify).toBe(
      `https://open.spotify.com/album/${"A".repeat(22)}`,
    );
  });

  it("only adds and updates when MusicBrainz has more editions than one page", async () => {
    const record = await release();
    await db().insert(listenLinks).values({
      releaseId: record.id,
      service: "deezer",
      url: "https://www.deezer.com/album/1",
    });
    const provider = fakeProvider({
      [record.mbid!]: { total: 150, editions: [edition("a", [spotify("A".repeat(22))])] },
    });
    await refreshListenLinks(db(), provider, { now });
    expect(await linksOf("releaseId", record.id)).toEqual({
      deezer: "https://www.deezer.com/album/1",
      spotify: `https://open.spotify.com/album/${"A".repeat(22)}`,
    });
  });

  it("keeps the links of a record gone or emptied at MusicBrainz and marks it read", async () => {
    const gone = await release();
    const empty = await release();
    for (const r of [gone, empty]) {
      await db().insert(listenLinks).values({
        releaseId: r.id,
        service: "deezer",
        url: "https://www.deezer.com/album/2",
      });
    }
    const provider = fakeProvider({ [empty.mbid!]: { total: 0, editions: [] } });
    const result = await refreshListenLinks(db(), provider, { now });
    for (const r of [gone, empty]) {
      expect(await linksOf("releaseId", r.id)).toEqual({
        deezer: "https://www.deezer.com/album/2",
      });
      expect(await checkedAt(releases, r.id)).toEqual(now);
    }
    expect(result).toMatchObject({ releases: 2, failed: 0, deferred: 0 });
  });

  it("stops for the night when MusicBrainz is unavailable, writing nothing for that record", async () => {
    const first = await release({ tracklistImportedAt: daysAgo(1) });
    const down = await release({ tracklistImportedAt: daysAgo(2) });
    await release({ tracklistImportedAt: daysAgo(3) });
    await artist();
    const calls: string[] = [];
    const provider = fakeProvider(
      {
        [first.mbid!]: { total: 1, editions: [edition("a", [deezer("3")])] },
        [down.mbid!]: new CatalogError("unavailable", "503"),
      },
      {},
      calls,
    );
    const result = await refreshListenLinks(db(), provider, { now });
    expect(calls).toEqual([first.mbid, down.mbid]);
    expect(await checkedAt(releases, first.id)).toEqual(now);
    expect(await checkedAt(releases, down.id)).toBeNull();
    expect(result).toMatchObject({ releases: 1, artists: 0, failed: 1, deferred: 2 });
  });

  it("goes on after another error on one record", async () => {
    const broken = await release({ tracklistImportedAt: daysAgo(1) });
    const fine = await release({ tracklistImportedAt: daysAgo(2) });
    const provider = fakeProvider({
      [broken.mbid!]: new Error("unexpected"),
      [fine.mbid!]: { total: 1, editions: [edition("a", [deezer("4")])] },
    });
    const result = await refreshListenLinks(db(), provider, { now });
    expect(await checkedAt(releases, broken.id)).toBeNull();
    expect(await linksOf("releaseId", fine.id)).toEqual({
      deezer: "https://www.deezer.com/album/4",
    });
    expect(result).toMatchObject({ releases: 1, failed: 1, deferred: 0 });
  });

  it("respects the caps: count limits and the time budget", async () => {
    for (let i = 0; i < 3; i++) await release({ tracklistImportedAt: daysAgo(i + 1) });
    await artist();
    await artist();
    const calls: string[] = [];
    const limited = await refreshListenLinks(db(), fakeProvider({}, {}, calls), {
      now,
      releaseLimit: 2,
      artistLimit: 1,
    });
    expect(calls).toHaveLength(3);
    expect(limited).toMatchObject({ releases: 2, artists: 1, deferred: 0 });

    // One minute per request, 2 minutes allowed: the third request waits for the next night.
    await db().update(releases).set({ linksCheckedAt: null });
    await db().update(artists).set({ linksCheckedAt: null });
    let elapsed = 0;
    const timed: string[] = [];
    const slow = fakeProvider({}, {}, timed);
    const result = await refreshListenLinks(
      db(),
      {
        ...slow,
        getEditionLinks: async (mbid: string) => {
          elapsed += 60_000;
          return slow.getEditionLinks(mbid);
        },
      } as CatalogProvider,
      { now, clock: () => elapsed, budgetMs: 120_000 },
    );
    expect(timed).toHaveLength(2);
    expect(result).toMatchObject({ releases: 2, artists: 0, deferred: 3 });
  });

  it("replaces an artist's links and changes nothing else on the artist", async () => {
    const person = await artist();
    await db()
      .insert(listenLinks)
      .values([
        { artistId: person.id, service: "deezer", url: "https://www.deezer.com/artist/5" },
        { artistId: person.id, service: "bandcamp", url: "https://gone.bandcamp.com/" },
      ]);
    const provider = fakeProvider(
      {},
      {
        [person.mbid!]: {
          mbid: person.mbid!,
          name: "Renamed at MusicBrainz",
          sortName: null,
          disambiguation: null,
          country: null,
          type: null,
          urlRelations: [
            { type: "free streaming", url: "https://www.deezer.com/artist/6" },
            {
              type: "free streaming",
              url: "https://open.spotify.com/artist/3PpJbrAbphauEun8Xf9tD2",
            },
          ],
        } as ProviderArtist,
      },
    );
    await refreshListenLinks(db(), provider, { now });
    expect(await linksOf("artistId", person.id)).toEqual({
      deezer: "https://www.deezer.com/artist/6",
      spotify: "https://open.spotify.com/artist/3PpJbrAbphauEun8Xf9tD2",
    });
    const [after] = await db().select().from(artists).where(eq(artists.id, person.id));
    const same = { linksCheckedAt: null, updatedAt: null };
    expect({ ...after, ...same }).toEqual({ ...person, ...same });
    expect(after!.linksCheckedAt).toEqual(now);
  });
});
