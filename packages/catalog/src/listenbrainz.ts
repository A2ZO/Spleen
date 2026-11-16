import { CatalogError } from "./errors";
import { sleep } from "./throttle";

/*
 * ListenBrainz "fresh releases" (https://listenbrainz.readthedocs.io, Explore API): releases
 * MusicBrainz knows around a date. Only used by the nightly job (`pnpm catalog:refresh`), never
 * while a page renders. No key; the MusicBrainz User-Agent; `X-RateLimit-*` headers honoured.
 */

export const LISTENBRAINZ_BASE_URL = "https://api.listenbrainz.org/1";

/** Longest wait accepted from `X-RateLimit-Reset-In`; more means something is wrong. */
const MAX_RATE_LIMIT_WAIT_S = 60;
const TIMEOUT_MS = 30_000;

export interface FreshRelease {
  releaseGroupMbid: string;
  releaseMbid: string | null;
  title: string;
  artistMbids: string[];
  /** As given by ListenBrainz: the date of one edition (`YYYY-MM-DD`). */
  releaseDate: string;
  primaryType: string | null;
  secondaryType: string | null;
}

export interface ListenBrainzOptions {
  userAgent?: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  /** Replaced in tests so a rate-limit wait does not really wait. */
  wait?: (ms: number) => Promise<void>;
}

export interface ListenBrainzClient {
  /** Releases dated from `releaseDate` (`YYYY-MM-DD`) to 90 days later. */
  freshReleases(releaseDate: string): Promise<FreshRelease[]>;
}

const isString = (value: unknown): value is string => typeof value === "string";
const optionalString = (value: unknown) => (isString(value) && value !== "" ? value : null);

function parseRelease(raw: unknown): FreshRelease | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const artistMbids = Array.isArray(r.artist_mbids) ? r.artist_mbids.filter(isString) : [];
  if (!isString(r.release_group_mbid) || !isString(r.release_date) || !isString(r.release_name)) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.release_date)) return null;
  return {
    releaseGroupMbid: r.release_group_mbid,
    releaseMbid: optionalString(r.release_mbid),
    title: r.release_name,
    artistMbids,
    releaseDate: r.release_date,
    primaryType: optionalString(r.release_group_primary_type),
    secondaryType: optionalString(r.release_group_secondary_type),
  };
}

/** Releases of `payload.releases`; throws when the answer does not have that shape. */
export function parseFreshReleases(body: unknown): FreshRelease[] {
  const releases = (body as { payload?: { releases?: unknown } } | null)?.payload?.releases;
  if (!Array.isArray(releases)) {
    throw new CatalogError("unavailable", "ListenBrainz: unexpected answer.");
  }
  return releases.map(parseRelease).filter((r): r is FreshRelease => r !== null);
}

export function createListenBrainzClient(options: ListenBrainzOptions = {}): ListenBrainzClient {
  const http = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? LISTENBRAINZ_BASE_URL;
  const wait = options.wait ?? sleep;
  let blockedUntil = 0;

  return {
    async freshReleases(releaseDate) {
      if (!options.userAgent) {
        throw new CatalogError("unavailable", "MUSICBRAINZ_USER_AGENT is not set.");
      }
      const pause = blockedUntil - Date.now();
      if (pause > MAX_RATE_LIMIT_WAIT_S * 1000) {
        throw new CatalogError("unavailable", "ListenBrainz: rate limit wait too long.");
      }
      if (pause > 0) await wait(pause);
      const url = new URL(`${baseUrl}/explore/fresh-releases/`);
      url.searchParams.set("release_date", releaseDate);
      url.searchParams.set("days", "90");
      url.searchParams.set("past", "false");
      url.searchParams.set("future", "true");

      let response: Response;
      try {
        response = await http(url, {
          headers: { "User-Agent": options.userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new CatalogError("unavailable", "ListenBrainz: unreachable.");
      }
      const remaining = Number(response.headers.get("X-RateLimit-Remaining"));
      const resetIn = Number(response.headers.get("X-RateLimit-Reset-In"));
      if (response.headers.has("X-RateLimit-Remaining") && remaining <= 0) {
        // An absurd or missing reset blocks the next call instead of waiting for it.
        const seconds = Number.isFinite(resetIn) ? Math.max(0, resetIn) : Infinity;
        blockedUntil = Date.now() + seconds * 1000;
      }
      if (!response.ok) {
        throw new CatalogError("unavailable", `ListenBrainz: HTTP ${response.status}.`);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new CatalogError("unavailable", "ListenBrainz: invalid JSON.");
      }
      return parseFreshReleases(body);
    },
  };
}
