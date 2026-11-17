import { createMusicBrainzProvider, type CatalogProvider, type Throttle } from "@spleen/catalog";
import {
  createReplayFetch,
  FIXTURE_RECORDING,
  FIXTURE_STREAMING_ALBUM,
} from "@spleen/catalog/testing";
import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { importEntity } from "./lib/catalog/import";
import { buildListenLinks, pickListenLinks, validListenUrl } from "./lib/listen-links";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* "Listen on" links: validation, import from the recorded answers, merges, reading. */

const THEODORA = "3d519348-d1eb-4e8d-aab4-85ebe819bc46";
const now = new Date("2026-11-17T12:00:00Z");
const noThrottle: Throttle = { acquire: async () => {}, backOff: async () => {} };

let handle: DbHandle;
let admin: SessionUser;
let provider: CatalogProvider;
const db = () => handle.db;
const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));

beforeAll(async () => {
  handle = await createTestDb();
  provider = createMusicBrainzProvider({
    userAgent: "Spleen-test/0.1 ( test@example.test )",
    throttle: noThrottle,
    fetch: createReplayFetch(),
  });
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: "listen-admin@example.test", emailVerified: true })
    .returning();
  await db().insert(schema.profiles).values({
    userId: row!.id,
    username: "listenadmin",
    displayName: "listenadmin",
    role: "admin",
    ageConfirmedAt: now,
  });
  admin = { id: row!.id, email: row!.email };
}, 60_000);

afterAll(() => handle.close());

async function linksOf(column: "releaseId" | "trackId" | "artistId", id: string) {
  const rows = await db()
    .select({ service: schema.listenLinks.service, url: schema.listenLinks.url })
    .from(schema.listenLinks)
    .where(eq(schema.listenLinks[column], id));
  return Object.fromEntries(rows.map((r) => [r.service, r.url]));
}

async function bySlug<T extends typeof schema.releases | typeof schema.artists>(
  table: T,
  slug: string,
) {
  const [row] = await db()
    .select()
    .from(table as typeof schema.releases)
    .where(eq(table.slug, slug));
  return row as T["$inferSelect"];
}

describe("validListenUrl", () => {
  it("accepts the direct forms of each service and rebuilds them", () => {
    const ok = [
      ["https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7", "release"],
      ["https://open.spotify.com/intl-fr/track/18Z7e7wPPzvYlJwuZj7cQ4?si=abc", "track"],
      ["https://www.deezer.com/fr/album/597350882", "release"],
      ["https://deezer.com/artist/13820325", "artist"],
      ["https://music.apple.com/gb/album/brat/1739079974", "release"],
      ["https://music.apple.com/de/song/1739079976", "track"],
      ["https://music.youtube.com/channel/UCabcdefghijklmnopqrstuv", "artist"],
      ["https://charlixcx.bandcamp.com/album/brat", "release"],
      ["https://charlixcx.bandcamp.com/track/360", "track"],
      ["https://charlixcx.bandcamp.com/", "artist"],
    ] as const;
    expect(ok.map(([url, kind]) => validListenUrl(url, kind)?.url)).toEqual([
      "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7",
      "https://open.spotify.com/track/18Z7e7wPPzvYlJwuZj7cQ4",
      "https://www.deezer.com/album/597350882",
      "https://www.deezer.com/artist/13820325",
      "https://music.apple.com/gb/album/1739079974",
      "https://music.apple.com/de/song/1739079976",
      "https://music.youtube.com/channel/UCabcdefghijklmnopqrstuv",
      "https://charlixcx.bandcamp.com/album/brat",
      "https://charlixcx.bandcamp.com/track/360",
      "https://charlixcx.bandcamp.com/",
    ]);
  });

  it("refuses everything else", () => {
    const refused = [
      ["http://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7", "release"],
      ["https://open.spotify.com.example.com/album/2lIZef4lzdvZkiiCzvPKj7", "release"],
      ["https://user@open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7", "release"],
      ["https://open.spotify.com:8443/album/2lIZef4lzdvZkiiCzvPKj7", "release"],
      ["https://open.spotify.com/track/2lIZef4lzdvZkiiCzvPKj7", "release"],
      ["javascript:alert(1)", "release"],
      ["https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7%2F..", "release"],
      ["https://open.spotify.com/album/%32lIZef4lzdvZkiiCzvPKj7", "release"],
      [`https://www.deezer.com/album/${"1".repeat(300)}`, "release"],
      ["https://music.youtube.com/playlist?list=OLAK5uy_abc", "release"],
      ["https://itunes.apple.com/gb/album/1739079974", "release"],
      ["https://bandcamp.com/album/brat", "release"],
      ["https://daily.bandcamp.com/features/brat", "release"],
      ["https://charlixcx.bandcamp.com/music", "artist"],
      ["https://tidal.com/album/367578589", "release"],
    ] as const;
    for (const [url, kind] of refused) expect(validListenUrl(url, kind), url).toBeNull();
  });

  it("drops tracking parameters by rebuilding the URL", () => {
    expect(
      validListenUrl("https://www.deezer.com/album/597350882?utm_source=x#top", "release")?.url,
    ).toBe("https://www.deezer.com/album/597350882");
  });

  it("keeps the first valid link per service, of the types read for that kind", () => {
    expect(
      pickListenLinks(
        [
          { type: "streaming", url: "https://open.spotify.com/track/18Z7e7wPPzvYlJwuZj7cQ4" },
          { type: "streaming", url: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7" },
          { type: "streaming", url: "https://open.spotify.com/album/0000000000000000000000" },
          { type: "discogs", url: "https://www.deezer.com/album/597350882" },
          { type: "bandcamp", url: "https://charlixcx.bandcamp.com/album/brat" },
        ],
        "release",
      ),
    ).toEqual([
      { service: "spotify", url: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7" },
    ]);
  });
});

describe("buildListenLinks", () => {
  it("lists the five services in a fixed order, direct links first chosen", () => {
    const links = buildListenLinks(
      [
        { service: "bandcamp", url: "https://charlixcx.bandcamp.com/album/brat" },
        { service: "spotify", url: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7" },
        // Invalid in the database, or stored under another service: the search is shown.
        { service: "deezer", url: "https://www.deezer.com.evil.test/album/1" },
        { service: "apple_music", url: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7" },
      ],
      "release",
      "BRAT",
      "Charli xcx",
    );
    expect(links).toEqual([
      {
        service: "spotify",
        url: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7",
        direct: true,
      },
      {
        service: "deezer",
        url: "https://www.deezer.com/search/Charli%20xcx%20BRAT",
        direct: false,
      },
      {
        service: "appleMusic",
        url: "https://music.apple.com/search?term=Charli%20xcx%20BRAT",
        direct: false,
      },
      {
        service: "youtubeMusic",
        url: "https://music.youtube.com/search?q=Charli%20xcx%20BRAT",
        direct: false,
      },
      { service: "bandcamp", url: "https://charlixcx.bandcamp.com/album/brat", direct: true },
    ]);
  });
});

describe("import", () => {
  it("stores the release and track links of the tracklist edition, not the credited artist's", async () => {
    const slug = await importEntity(db(), provider, "release_group", FIXTURE_STREAMING_ALBUM.mbid, {
      now,
    });
    const release = await bySlug(schema.releases, slug);
    expect(await linksOf("releaseId", release.id)).toEqual({
      spotify: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7",
      deezer: "https://www.deezer.com/album/597350882",
      apple_music: "https://music.apple.com/gb/album/1739079974",
    });
    expect(release.linksCheckedAt).toBeNull();

    const [track] = await db()
      .select({ id: schema.tracks.id })
      .from(schema.tracks)
      .where(eq(schema.tracks.title, "360"));
    expect(await linksOf("trackId", track!.id)).toEqual({
      spotify: "https://open.spotify.com/track/18Z7e7wPPzvYlJwuZj7cQ4",
      deezer: "https://www.deezer.com/track/2790796972",
      apple_music: "https://music.apple.com/de/song/1739079976",
    });

    const [credited] = await db()
      .select()
      .from(schema.artists)
      .where(eq(schema.artists.name, "Charli xcx"));
    expect(await linksOf("artistId", credited!.id)).toEqual({});
    expect(credited!.linksCheckedAt).toBeNull();

    const page = await api(null).release.bySlug({ slug });
    expect(page?.listenLinks.map((l) => [l.service, l.direct])).toEqual([
      ["spotify", true],
      ["deezer", true],
      ["appleMusic", true],
      ["youtubeMusic", false],
      ["bandcamp", false],
    ]);
  });

  it("updates a changed link on re-import and never removes one", async () => {
    const slug = await importEntity(db(), provider, "release_group", FIXTURE_STREAMING_ALBUM.mbid);
    const release = await bySlug(schema.releases, slug);
    await db()
      .update(schema.listenLinks)
      .set({ url: "https://open.spotify.com/album/0000000000000000000000" })
      .where(eq(schema.listenLinks.releaseId, release.id));
    await db().insert(schema.listenLinks).values({
      releaseId: release.id,
      service: "bandcamp",
      url: "https://charlixcx.bandcamp.com/album/brat",
    });
    await db()
      .update(schema.releases)
      .set({ tracklistImportedAt: null })
      .where(eq(schema.releases.id, release.id));
    await importEntity(db(), provider, "release_group", FIXTURE_STREAMING_ALBUM.mbid, { now });
    expect(await linksOf("releaseId", release.id)).toEqual({
      spotify: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7",
      deezer: "https://www.deezer.com/album/597350882",
      apple_music: "https://music.apple.com/gb/album/1739079974",
      bandcamp: "https://charlixcx.bandcamp.com/album/brat",
    });
  });

  it("stores an artist's links on its own import and marks them checked", async () => {
    const slug = await importEntity(db(), provider, "artist", THEODORA, { now });
    const artist = await bySlug(schema.artists, slug);
    expect(await linksOf("artistId", artist.id)).toEqual({
      spotify: "https://open.spotify.com/artist/3PpJbrAbphauEun8Xf9tD2",
      deezer: "https://www.deezer.com/artist/13820325",
    });
    expect(artist.linksCheckedAt).toEqual(now);
    const page = await api(null).artist.bySlug({ slug });
    expect(page?.listenLinks[0]).toEqual({
      service: "spotify",
      url: "https://open.spotify.com/artist/3PpJbrAbphauEun8Xf9tD2",
      direct: true,
    });
    expect(page?.listenLinks[4]).toEqual({
      service: "bandcamp",
      url: "https://bandcamp.com/search?q=Theodora",
      direct: false,
    });
  });

  it("writes a recording's own links when the tracklist already brought the track", async () => {
    const withLinks: CatalogProvider = {
      ...provider,
      getRecording: async (mbid) => ({
        ...(await provider.getRecording(mbid)),
        urlRelations: [
          { type: "free streaming", url: "https://open.spotify.com/track/4vLYewWIvqHfKtJDk8c8tq" },
        ],
      }),
    };
    const slug = await importEntity(db(), withLinks, "recording", FIXTURE_RECORDING.mbid, { now });
    const [track] = await db()
      .select({ id: schema.tracks.id })
      .from(schema.tracks)
      .where(eq(schema.tracks.slug, slug));
    expect(await linksOf("trackId", track!.id)).toEqual({
      spotify: "https://open.spotify.com/track/4vLYewWIvqHfKtJDk8c8tq",
    });
    const page = await api(null).track.bySlug({ slug });
    expect(page?.listenLinks.find((l) => l.service === "spotify")?.direct).toBe(true);
    expect(page?.listenLinks.find((l) => l.service === "deezer")?.url).toBe(
      "https://www.deezer.com/search/Miles%20Davis%20So%20What",
    );
  });
});

describe("merges", () => {
  it("give the page kept the services it lacks and drop the duplicate's", async () => {
    const [keep, dup] = await db()
      .insert(schema.artists)
      .values([
        { slug: "keep-links", name: "Keep" },
        { slug: "dup-links", name: "Dup" },
      ])
      .returning();
    await db()
      .insert(schema.listenLinks)
      .values([
        {
          artistId: keep!.id,
          service: "spotify",
          url: "https://open.spotify.com/artist/AAAAAAAAAAAAAAAAAAAAAA",
        },
        {
          artistId: dup!.id,
          service: "spotify",
          url: "https://open.spotify.com/artist/BBBBBBBBBBBBBBBBBBBBBB",
        },
        { artistId: dup!.id, service: "deezer", url: "https://www.deezer.com/artist/42" },
      ]);
    await api(admin).admin.merge({
      kind: "artist",
      keep: keep!.slug,
      duplicate: dup!.slug,
      reason: "Même artiste importé deux fois",
    });
    expect(await linksOf("artistId", keep!.id)).toEqual({
      spotify: "https://open.spotify.com/artist/AAAAAAAAAAAAAAAAAAAAAA",
      deezer: "https://www.deezer.com/artist/42",
    });
    expect(await linksOf("artistId", dup!.id)).toEqual({});
  });
});
