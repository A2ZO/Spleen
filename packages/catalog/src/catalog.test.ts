import { describe, expect, it, vi } from "vitest";

import {
  CatalogError,
  createMemoryThrottle,
  createMusicBrainzProvider,
  normalizeLanguage,
  parsePartialDate,
  pickReferenceEdition,
  type Throttle,
} from ".";
import { escapeLucene } from "./rules";
import {
  createReplayFetch,
  FIXTURE_ALBUM,
  FIXTURE_ARTIST_QUERY,
  FIXTURE_RECORDING,
} from "./test-fixtures";

const noThrottle = (): Throttle & { backOffs: number[] } => {
  const backOffs: number[] = [];
  return { acquire: async () => {}, backOff: async (s) => void backOffs.push(s), backOffs };
};

const replayProvider = (covers: string[] = []) =>
  createMusicBrainzProvider({
    userAgent: "Spleen-test/0.1 ( test@example.test )",
    throttle: noThrottle(),
    fetch: createReplayFetch({ covers }),
  });

describe("rules", () => {
  it("parses partial dates", () => {
    expect(parsePartialDate("1959")).toEqual({ date: "1959-01-01", precision: "year" });
    expect(parsePartialDate("1959-08")).toEqual({ date: "1959-08-01", precision: "month" });
    expect(parsePartialDate("1959-08-17")).toEqual({ date: "1959-08-17", precision: "day" });
    expect(parsePartialDate("")).toBeNull();
    expect(parsePartialDate(undefined)).toBeNull();
  });

  it("picks the official original edition, preferred country, most precise date", () => {
    const edition = (mbid: string, status: string | null, date: string, country: string) => ({
      mbid,
      status,
      date: parsePartialDate(date),
      country,
    });
    expect(
      pickReferenceEdition([
        edition("a", "official", "1975", "GB"),
        edition("b", "promotion", "1959-01-01", "US"),
        edition("c", "official", "1959", "JP"),
        edition("d", "official", "1959", "US"),
        edition("e", "official", "1959-08-17", "US"),
      ])?.mbid,
    ).toBe("e");
    expect(pickReferenceEdition([])).toBeNull();
  });

  it("maps languages and escapes search syntax", () => {
    expect(normalizeLanguage("fra")).toBe("fr");
    expect(normalizeLanguage("eng")).toBe("en");
    expect(normalizeLanguage("jpn")).toBe("jpn");
    expect(normalizeLanguage("zxx")).toBeNull();
    expect(escapeLucene('AC/DC: "Back" (in) black!')).toBe(
      'AC\\/DC\\: \\"Back\\" \\(in\\) black\\!',
    );
  });
});

describe("MusicBrainz provider (recorded responses)", () => {
  it("searches release groups, studio albums first", async () => {
    const hits = await replayProvider().searchReleaseGroups(FIXTURE_ALBUM.query);
    expect(hits[0]?.item).toMatchObject({
      mbid: FIXTURE_ALBUM.mbid,
      title: "Kind of Blue",
      type: "album",
      secondaryTypes: [],
    });
    expect(hits[0]?.item.artists[0]?.artist.name).toBe("Miles Davis");
    const scores = hits.map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("reads a release group with genres, date and editions", async () => {
    const album = await replayProvider().getReleaseGroup(FIXTURE_ALBUM.mbid);
    expect(album.firstReleaseDate).toEqual({ date: "1959-08-17", precision: "day" });
    expect(album.genres).toContain("jazz");
    expect(album.genres.length).toBeLessThanOrEqual(5);
    expect(album.artists.map((c) => c.artist.mbid)).toEqual([
      "561d854a-6a28-4aa7-8c99-323e6ce46c2a",
    ]);
    expect(album.artists[0]?.artist).toMatchObject({ country: "US", type: "person" });
    expect(pickReferenceEdition(album.editions)?.mbid).toBe("79ed3ff2-1b33-3245-8755-947554bc8b3d");
  });

  it("reads the tracklist of the reference edition", async () => {
    const tracklist = await replayProvider().getTracklist("79ed3ff2-1b33-3245-8755-947554bc8b3d");
    expect(tracklist.language).toBe("en");
    expect(tracklist.tracks).toHaveLength(5);
    expect(tracklist.tracks[0]).toMatchObject({ disc: 1, position: 1 });
    expect(tracklist.tracks[0]?.recording.title).toBe("So What");
    expect(tracklist.tracks[0]?.recording.lengthMs).toBeGreaterThan(500_000);
  });

  it("searches artists and browses a discography", async () => {
    const provider = replayProvider();
    const [hit] = await provider.searchArtists(FIXTURE_ARTIST_QUERY);
    expect(hit?.item).toMatchObject({ name: "Theodora", country: "FR", type: "person" });
    const artist = await provider.getArtist(hit!.item.mbid);
    expect(artist.disambiguation).toMatch(/French singer/);
    const groups = await provider.getArtistReleaseGroups(artist.mbid);
    expect(groups.some((g) => g.type === "album")).toBe(true);
    expect(groups.some((g) => g.type === "single")).toBe(true);
    expect(new Set(groups.map((g) => g.mbid)).size).toBe(groups.length);
  });

  it("reads a recording and the albums it appears on", async () => {
    const provider = replayProvider();
    const hits = await provider.searchRecordings(FIXTURE_RECORDING.query);
    expect(hits.length).toBeGreaterThan(0);
    const recording = await provider.getRecording(FIXTURE_RECORDING.mbid);
    expect(recording.title).toBe("So What");
    expect(recording.appearsOn.map((a) => a.releaseGroup.mbid)).toContain(FIXTURE_ALBUM.mbid);
  });

  it("finds covers on Cover Art Archive", async () => {
    const provider = replayProvider([FIXTURE_ALBUM.mbid]);
    expect(await provider.getCoverUrl(FIXTURE_ALBUM.mbid)).toBe(
      `https://coverartarchive.org/release-group/${FIXTURE_ALBUM.mbid}/front-500`,
    );
    expect(await provider.getCoverUrl("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("MusicBrainz provider (errors)", () => {
  const withResponses = (...statuses: number[]) => {
    const throttle = noThrottle();
    const fetchMock = vi.fn(async () => {
      const status = statuses.shift() ?? 200;
      return new Response(status === 200 ? '{"id":"x","name":"X"}' : "{}", {
        status,
        headers: status === 503 ? { "retry-after": "3" } : {},
      });
    });
    const provider = createMusicBrainzProvider({
      userAgent: "Spleen-test/0.1 ( test@example.test )",
      throttle,
      fetch: fetchMock as unknown as typeof fetch,
    });
    return { provider, throttle, fetchMock };
  };

  it("sends the User-Agent and refuses to run without one", async () => {
    const { provider, fetchMock } = withResponses(200);
    await provider.getArtist("x");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^Spleen-test/);
    expect(() => createMusicBrainzProvider({ userAgent: " ", throttle: noThrottle() })).toThrow(
      CatalogError,
    );
  });

  it("requires every word, ignoring punctuation-only ones", async () => {
    const fetchMock = vi.fn(async () => new Response('{"release-groups":[]}'));
    const provider = createMusicBrainzProvider({
      userAgent: "Spleen-test/0.1 ( test@example.test )",
      throttle: noThrottle(),
      fetch: fetchMock as unknown as typeof fetch,
    });
    await provider.searchReleaseGroups("Simon & Garfunkel");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get("query")).toBe(
      "(releasegroup:Simon OR artist:Simon) AND (releasegroup:Garfunkel OR artist:Garfunkel)",
    );
  });

  it("backs every caller off on 503 and retries", async () => {
    const { provider, throttle, fetchMock } = withResponses(503, 200);
    expect((await provider.getArtist("x")).name).toBe("X");
    expect(throttle.backOffs).toEqual([3]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated 503 with an `unavailable` error", async () => {
    const { provider } = withResponses(503, 503, 503);
    await expect(provider.getArtist("x")).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps 404 and 400 to `not_found` without retrying", async () => {
    const { provider, fetchMock } = withResponses(404);
    await expect(provider.getArtist("x")).rejects.toMatchObject({ kind: "not_found" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(withResponses(400).provider.getArtist("x")).rejects.toMatchObject({
      kind: "not_found",
    });
  });
});

describe("memory throttle", () => {
  it("spaces requests", async () => {
    const throttle = createMemoryThrottle(50);
    const start = Date.now();
    await Promise.all([throttle.acquire(), throttle.acquire(), throttle.acquire()]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(95);
  });
});
