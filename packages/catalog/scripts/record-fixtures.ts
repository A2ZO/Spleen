/**
 * Records real MusicBrainz responses into test/fixtures (run by hand, never in CI):
 *   pnpm --filter @spleen/catalog record
 * Tests replay them through a fake `fetch`, so they never touch the network.
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRootEnv } from "@spleen/db/env";

import { createMemoryThrottle, createMusicBrainzProvider, MUSICBRAINZ_INTERVAL_MS } from "../src";
import { rankEditions } from "../src/rules";
import {
  FIXTURE_ALBUM,
  FIXTURE_ARTIST_QUERY,
  FIXTURE_RECORDING,
  FIXTURE_STREAMING_ALBUM,
  fixtureKey,
} from "../src/test-fixtures";

loadRootEnv();
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../test/fixtures");
await mkdir(dir, { recursive: true });
// Only the MusicBrainz answers are recorded here: the ListenBrainz one stays.
for (const file of await readdir(dir)) {
  if (/^\d+\.json$/.test(file) || file === "manifest.json") await rm(path.join(dir, file));
}

const manifest: Record<string, string> = {};
const recordingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = String(input);
  if (init?.method === "HEAD" || !response.ok) return response;
  const body = await response.text();
  const file = `${String(Object.keys(manifest).length + 1).padStart(2, "0")}.json`;
  manifest[fixtureKey(url)] = file;
  await writeFile(path.join(dir, file), `${JSON.stringify(JSON.parse(body), null, 2)}\n`);
  return new Response(body, { status: response.status, headers: response.headers });
};

const provider = createMusicBrainzProvider({
  userAgent: process.env.MUSICBRAINZ_USER_AGENT,
  throttle: createMemoryThrottle(MUSICBRAINZ_INTERVAL_MS),
  fetch: recordingFetch,
  // MusicBrainz is often busy: be patient, this runs by hand.
  maxAttempts: 8,
});

await provider.searchReleaseGroups(FIXTURE_ALBUM.query);
await recordAlbum(FIXTURE_ALBUM.mbid);

const [artist] = await provider.searchArtists(FIXTURE_ARTIST_QUERY);
if (!artist) throw new Error("Fixture artist not found.");
await provider.getArtist(artist.item.mbid);
await provider.getArtistReleaseGroups(artist.item.mbid);

await provider.searchRecordings(FIXTURE_RECORDING.query);
await provider.getRecording(FIXTURE_RECORDING.mbid);

await recordAlbum(FIXTURE_STREAMING_ALBUM.mbid);
// Nightly "Listen on" re-read: every edition of the group with its URL relationships.
await provider.getEditionLinks(FIXTURE_STREAMING_ALBUM.mbid);

async function recordAlbum(mbid: string) {
  const album = await provider.getReleaseGroup(mbid);
  // Same fallback as the importer: the next edition when MusicBrainz cannot serve one.
  for (const edition of rankEditions(album.editions).slice(0, 2)) {
    try {
      await provider.getTracklist(edition.mbid);
      return;
    } catch (error) {
      console.error(`edition ${edition.mbid}: ${String(error)}`);
    }
  }
}

await writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`catalog: ${Object.keys(manifest).length} responses recorded`);
