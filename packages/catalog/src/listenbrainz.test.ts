import { describe, expect, it } from "vitest";

import { CatalogError, createListenBrainzClient } from ".";
import { createListenBrainzReplayFetch, FIXTURE_FRESH_RELEASES_DATE } from "./test-fixtures";

const client = (replay = createListenBrainzReplayFetch(), waits: number[] = []) =>
  createListenBrainzClient({
    userAgent: "Spleen-test/0.1 ( test@example.test )",
    fetch: replay,
    wait: async (ms) => void waits.push(ms),
  });

describe("ListenBrainz fresh releases", () => {
  it("asks for the next 90 days only and reads the recorded answer", async () => {
    const replay = createListenBrainzReplayFetch();
    const releases = await client(replay).freshReleases(FIXTURE_FRESH_RELEASES_DATE);
    const url = new URL(replay.calls[0]!);
    expect(url.pathname).toBe("/1/explore/fresh-releases/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      release_date: "2026-11-16",
      days: "90",
      past: "false",
      future: "true",
    });
    expect(releases).toHaveLength(7);
    expect(releases[1]).toEqual({
      releaseGroupMbid: "394cb8e9-82b3-4592-a7f3-3fb517e485ad",
      releaseMbid: expect.any(String),
      title: "Through the Night",
      artistMbids: ["945329a8-2c4c-44bf-937b-3ae10730fa89"],
      releaseDate: "2026-12-02",
      primaryType: "Album",
      secondaryType: null,
    });
    expect(releases.find((r) => r.artistMbids.length > 1)?.secondaryType).toBe("Soundtrack");
  });

  it("turns HTTP errors and bad answers into an unavailable catalog error", async () => {
    for (const replay of [
      createListenBrainzReplayFetch({ status: 503, body: "{}" }),
      createListenBrainzReplayFetch({ body: "<html>" }),
      createListenBrainzReplayFetch({ body: '{"payload":{}}' }),
    ]) {
      const error = await client(replay)
        .freshReleases("2026-11-16")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CatalogError);
      expect((error as CatalogError).kind).toBe("unavailable");
    }
    const down = Object.assign(async () => Promise.reject(new Error("offline")), { calls: [] });
    await expect(client(down as never).freshReleases("2026-11-16")).rejects.toThrow(CatalogError);
  });

  it("waits for the rate limit reset, but never for an absurd one", async () => {
    const waits: number[] = [];
    const limited = client(
      createListenBrainzReplayFetch({
        headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset-In": "5" },
      }),
      waits,
    );
    await limited.freshReleases("2026-11-16");
    await limited.freshReleases("2026-11-16");
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(4000);

    const absurd = client(
      createListenBrainzReplayFetch({
        headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset-In": "3600" },
      }),
    );
    expect(await absurd.freshReleases("2026-11-16")).toHaveLength(7);
    await expect(absurd.freshReleases("2026-11-16")).rejects.toThrow(/too long/);
  });
});
