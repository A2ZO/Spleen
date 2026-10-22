import type { ReleaseType } from "@spleen/validators";

import { CatalogError } from "../errors";
import { escapeLucene, isMainRelease, normalizeLanguage, parsePartialDate } from "../rules";
import type {
  ArtistCredit,
  CatalogProvider,
  ProviderArtist,
  ProviderRecording,
  RecordingDetail,
  ReleaseEdition,
  ReleaseGroupDetail,
  ReleaseGroupSummary,
  SearchHit,
  Throttle,
  Tracklist,
} from "../types";
import type {
  MbArtist,
  MbArtistCredit,
  MbGenre,
  MbRecording,
  MbRelease,
  MbReleaseGroup,
  MbReleaseGroupBrowse,
} from "./raw";

export interface MusicBrainzOptions {
  /** Mandatory, with a contact: "Spleen/0.1 ( contact@example.com )". */
  userAgent: string | undefined;
  /** Global 1 request/second gate (MusicBrainz limit per IP, shared by the whole site). */
  throttle: Throttle;
  fetch?: typeof fetch;
  baseUrl?: string;
  coverArtBaseUrl?: string;
  /** Tries per request when MusicBrainz is overloaded (503 / 429) or unreachable. */
  maxAttempts?: number;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://musicbrainz.org/ws/2";
const DEFAULT_COVER_ART_BASE_URL = "https://coverartarchive.org";
const BROWSE_PAGE_SIZE = 100;
/** Discography import cap: 2 pages of albums / EPs and 1 page of singles (4 requests at most). */
const ALBUM_PAGES = 2;
const SINGLE_PAGES = 1;
const MAX_GENRES = 5;
/** Longest pause after a 503 / 429, whatever the attempt number or `Retry-After`. */
const MAX_BACK_OFF_SECONDS = 30;
/** Search ranking: live albums, compilations, remixes… after studio releases of equal score. */
const SECONDARY_TYPE_PENALTY = 10;

const RELEASE_TYPES: Record<string, ReleaseType> = { album: "album", ep: "ep", single: "single" };

export function createMusicBrainzProvider(options: MusicBrainzOptions): CatalogProvider {
  const userAgent = options.userAgent?.trim();
  if (!userAgent) {
    throw new CatalogError("unavailable", "MUSICBRAINZ_USER_AGENT is not set.");
  }
  const http = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const coverArtBaseUrl = options.coverArtBaseUrl ?? DEFAULT_COVER_ART_BASE_URL;
  const maxAttempts = options.maxAttempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${baseUrl}/${path}?${new URLSearchParams({ ...params, fmt: "json" })}`;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await options.throttle.acquire();
      let response: Response;
      try {
        response = await http(url, {
          headers: { "User-Agent": userAgent!, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        continue; // Network error or timeout: the next attempt waits for its own slot.
      }
      if (response.ok) return (await response.json()) as T;
      // 400 = malformed id: for callers it is the same as an unknown entity.
      if (response.status === 404 || response.status === 400) {
        throw new CatalogError("not_found", `MusicBrainz: ${path} not found.`);
      }
      if (response.status === 503 || response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const seconds = retryAfter > 0 ? retryAfter : 2 ** attempt;
        await options.throttle.backOff(Math.min(seconds, MAX_BACK_OFF_SECONDS));
      }
    }
    throw new CatalogError(
      "unavailable",
      `MusicBrainz: ${path} failed after ${maxAttempts} tries.`,
    );
  }

  return {
    async searchReleaseGroups(query, limit = 10) {
      const data = await get<{ "release-groups": MbReleaseGroup[] }>("release-group", {
        query: everyWordIn(query, "releasegroup", "artist"),
        limit: String(limit),
      });
      return data["release-groups"]
        .map((rg) => {
          const item = toReleaseGroupSummary(rg);
          const penalty = isMainRelease(item.secondaryTypes) ? 0 : SECONDARY_TYPE_PENALTY;
          return { score: Math.max(0, (rg.score ?? 0) - penalty), item };
        })
        .sort((a, b) => b.score - a.score);
    },

    async searchArtists(query, limit = 10) {
      const data = await get<{ artists: MbArtist[] }>("artist", {
        query: escapeLucene(query),
        limit: String(limit),
      });
      return data.artists.map((a) => ({ score: a.score ?? 0, item: toArtist(a) }));
    },

    async searchRecordings(query, limit = 10) {
      const data = await get<{ recordings: MbRecording[] }>("recording", {
        query: everyWordIn(query, "recording", "artist"),
        limit: String(limit),
      });
      return data.recordings.map((r): SearchHit<ProviderRecording> => ({
        score: r.score ?? 0,
        item: toRecording(r),
      }));
    },

    async getReleaseGroup(mbid) {
      const rg = await get<MbReleaseGroup>(`release-group/${mbid}`, {
        inc: "artist-credits+genres+releases",
      });
      return toReleaseGroupDetail(rg);
    },

    async getTracklist(releaseMbid) {
      const release = await get<MbRelease>(`release/${releaseMbid}`, {
        inc: "recordings+artist-credits",
      });
      return {
        releaseMbid: release.id,
        language: normalizeLanguage(release["text-representation"]?.language),
        tracks: (release.media ?? []).flatMap((medium) =>
          (medium.tracks ?? []).map((track) => ({
            disc: medium.position,
            position: track.position,
            recording: toRecording({
              ...track.recording,
              length: track.recording.length ?? track.length,
            }),
          })),
        ),
      } satisfies Tracklist;
    },

    async getArtist(mbid) {
      return toArtist(await get<MbArtist>(`artist/${mbid}`, {}));
    },

    async getArtistReleaseGroups(mbid) {
      const result: ReleaseGroupSummary[] = [];
      for (const [type, pages] of [
        ["album|ep", ALBUM_PAGES],
        ["single", SINGLE_PAGES],
      ] as const) {
        for (let page = 0; page < pages; page++) {
          const data = await get<MbReleaseGroupBrowse>("release-group", {
            artist: mbid,
            type,
            inc: "artist-credits",
            limit: String(BROWSE_PAGE_SIZE),
            offset: String(page * BROWSE_PAGE_SIZE),
          });
          result.push(...data["release-groups"].map(toReleaseGroupSummary));
          if ((page + 1) * BROWSE_PAGE_SIZE >= data["release-group-count"]) break;
        }
      }
      return result;
    },

    async getRecording(mbid) {
      const recording = await get<MbRecording>(`recording/${mbid}`, {
        inc: "artist-credits+releases+release-groups",
      });
      return {
        ...toRecording(recording),
        appearsOn: (recording.releases ?? []).flatMap((release) =>
          release["release-group"]
            ? [
                {
                  releaseGroup: toReleaseGroupSummary(release["release-group"]),
                  edition: toEdition(release),
                },
              ]
            : [],
        ),
      } satisfies RecordingDetail;
    },

    async getCoverUrl(releaseGroupMbid) {
      // Cover Art Archive is a separate service (no MusicBrainz quota). It answers with a
      // redirect to the image when a front cover exists, 404 otherwise.
      const url = `${coverArtBaseUrl}/release-group/${releaseGroupMbid}/front-500`;
      try {
        const response = await http(url, {
          method: "HEAD",
          redirect: "manual",
          headers: { "User-Agent": userAgent! },
          signal: AbortSignal.timeout(timeoutMs),
        });
        return response.status >= 200 && response.status < 400 ? url : null;
      } catch {
        return null; // A missing cover never fails an import: the generated sleeve is used.
      }
    },
  };
}

/**
 * Lucene query where every word must appear in the title or the artist name, so
 * "miles davis kind of blue" finds the album rather than anything titled "Miles Davis".
 */
function everyWordIn(text: string, titleField: string, artistField: string): string {
  // "&", "-" or "†" alone are not words: as required terms they would match nothing.
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return `${titleField}:(${escapeLucene(text.trim())})`;
  return words
    .map(escapeLucene)
    .map((word) => `(${titleField}:${word} OR ${artistField}:${word})`)
    .join(" AND ");
}

function toArtist(a: MbArtist): ProviderArtist {
  return {
    mbid: a.id,
    name: a.name,
    sortName: a["sort-name"] || null,
    disambiguation: a.disambiguation || null,
    country: a.country && /^[A-Z]{2}$/.test(a.country) ? a.country : null,
    type: a.type ? a.type.toLowerCase() : null,
  };
}

function toCredits(credits: MbArtistCredit[] | undefined): ArtistCredit[] {
  const seen = new Set<string>();
  return (credits ?? []).flatMap((credit) => {
    if (seen.has(credit.artist.id)) return [];
    seen.add(credit.artist.id);
    return [
      {
        artist: toArtist(credit.artist),
        creditName: credit.name && credit.name !== credit.artist.name ? credit.name : null,
      },
    ];
  });
}

function toRecording(r: MbRecording): ProviderRecording {
  return {
    mbid: r.id,
    title: r.title,
    lengthMs: r.length ?? null,
    artists: toCredits(r["artist-credit"]),
  };
}

function toEdition(release: MbRelease): ReleaseEdition {
  return {
    mbid: release.id,
    status: release.status ? release.status.toLowerCase() : null,
    date: parsePartialDate(release.date),
    country: release.country ?? null,
  };
}

function toReleaseGroupSummary(rg: MbReleaseGroup): ReleaseGroupSummary {
  return {
    mbid: rg.id,
    title: rg.title,
    // Broadcasts, "Other" and untyped groups are shown as albums.
    type: RELEASE_TYPES[(rg["primary-type"] ?? "").toLowerCase()] ?? "album",
    secondaryTypes: (rg["secondary-types"] ?? []).map((t) => t.toLowerCase()),
    firstReleaseDate: parsePartialDate(rg["first-release-date"]),
    artists: toCredits(rg["artist-credit"]),
  };
}

const topGenres = (genres: MbGenre[] | undefined) =>
  (genres ?? [])
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, MAX_GENRES)
    .map((g) => g.name);

function toReleaseGroupDetail(rg: MbReleaseGroup): ReleaseGroupDetail {
  // Many albums have no genre votes yet: fall back to the main artist's genres.
  const own = topGenres(rg.genres);
  return {
    ...toReleaseGroupSummary(rg),
    genres: own.length > 0 ? own : topGenres(rg["artist-credit"]?.[0]?.artist.genres),
    editions: (rg.releases ?? []).map(toEdition),
  };
}
