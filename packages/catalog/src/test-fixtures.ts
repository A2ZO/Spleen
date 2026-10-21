import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Recorded MusicBrainz responses (test/fixtures, made by scripts/record-fixtures.ts) and a
 * fake `fetch` replaying them. Shared with packages/api tests through "@spleen/catalog/testing".
 */

export const FIXTURE_ALBUM = {
  query: "miles davis kind of blue",
  mbid: "8e8a594f-2175-38c7-a871-abb68ec363e7",
};
export const FIXTURE_ARTIST_QUERY = "theodora";
export const FIXTURE_RECORDING = {
  query: "so what miles davis",
  /** "So What", first track of Kind of Blue. */
  mbid: "60f750f4-d222-46b7-ad5c-905334c9a48a",
};

/** Request identity: path and query string without the base URL and `fmt`. */
export function fixtureKey(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("fmt");
  parsed.searchParams.sort();
  return `${parsed.pathname.replace(/^.*\/ws\/2\//, "")}?${parsed.searchParams}`;
}

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test/fixtures");

export interface ReplayOptions {
  /** Release-group ids that Cover Art Archive should report as having a front cover. */
  covers?: string[];
}

/** A `fetch` that answers from the recorded fixtures, and 404 for anything else. */
export function createReplayFetch(options: ReplayOptions = {}): typeof fetch & { calls: string[] } {
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as Record<
    string,
    string
  >;
  const calls: string[] = [];
  const replay = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("coverartarchive.org")) {
      const mbid = /release-group\/([0-9a-f-]+)/.exec(url)?.[1] ?? "";
      return new Response(null, { status: options.covers?.includes(mbid) ? 307 : 404 });
    }
    if (init?.method === "HEAD") return new Response(null, { status: 404 });
    const file = manifest[fixtureKey(url)];
    if (!file) return new Response('{"error":"Not Found"}', { status: 404 });
    return new Response(readFileSync(path.join(dir, file), "utf8"), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return Object.assign(replay as typeof fetch, { calls });
}
