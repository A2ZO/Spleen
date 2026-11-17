import type { ProviderUrlRelation } from "@spleen/catalog";

import type { ListenLink, ListenService } from "../types";

/*
 * "Listen on" links (docs/catalogue.md, « Écouter sur… »). MusicBrainz URLs are typed by
 * volunteers: every URL goes through `validListenUrl` before it is stored and again before it
 * is shown, and only the URL rebuilt from the validated parts is ever used.
 */

export type ListenKind = "release" | "track" | "artist";

/** Display order, fixed. */
export const LISTEN_SERVICES: readonly ListenService[] = [
  "spotify",
  "deezer",
  "appleMusic",
  "youtubeMusic",
  "bandcamp",
];

/** Database enum value (`listen_service`) of each service. */
export const LISTEN_SERVICE_DB = {
  spotify: "spotify",
  deezer: "deezer",
  appleMusic: "apple_music",
  youtubeMusic: "youtube_music",
  bandcamp: "bandcamp",
} as const satisfies Record<ListenService, string>;

export type ListenServiceDb = (typeof LISTEN_SERVICE_DB)[ListenService];

const FROM_DB = Object.fromEntries(
  Object.entries(LISTEN_SERVICE_DB).map(([service, db]) => [db, service]),
) as Record<ListenServiceDb, ListenService>;

export const listenServiceFromDb = (value: string): ListenService | null =>
  FROM_DB[value as ListenServiceDb] ?? null;

const MAX_URL_LENGTH = 300;

/** Relationship types read for every kind of entity, then the artist-only ones. */
const LINK_TYPES = new Set([
  "free streaming",
  "streaming",
  "purchase for download",
  "download for free",
]);
const ARTIST_LINK_TYPES = new Set(["apple music", "bandcamp", "youtube music"]);

const SPOTIFY_PATH = { release: "album", track: "track", artist: "artist" } as const;
const APPLE_PATH = { release: "album", track: "song", artist: "artist" } as const;

export interface ValidListenUrl {
  service: ListenService;
  url: string;
}

/**
 * The service and the rebuilt URL when `raw` is a direct link of that kind of entity on one of
 * the five services, null otherwise (a refused link leaves the search link).
 */
export function validListenUrl(raw: string, kind: ListenKind): ValidListenUrl | null {
  if (raw.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname;
  const path = url.pathname;

  if (host === "open.spotify.com") {
    const match = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?([a-z]+)\/([0-9A-Za-z]{22})$/.exec(path);
    if (!match || match[1] !== SPOTIFY_PATH[kind]) return null;
    return { service: "spotify", url: `https://open.spotify.com/${match[1]}/${match[2]}` };
  }

  if (host === "www.deezer.com" || host === "deezer.com") {
    const match = /^\/(?:[a-z]{2}\/)?([a-z]+)\/([0-9]{1,20})$/.exec(path);
    if (!match || match[1] !== SPOTIFY_PATH[kind]) return null;
    return { service: "deezer", url: `https://www.deezer.com/${match[1]}/${match[2]}` };
  }

  if (host === "music.apple.com") {
    const match = /^\/([a-z]{2})\/([a-z]+)\/(?:[^/]+\/)?([0-9]{1,20})$/.exec(path);
    if (!match || match[2] !== APPLE_PATH[kind]) return null;
    return {
      service: "appleMusic",
      url: `https://music.apple.com/${match[1]}/${match[2]}/${match[3]}`,
    };
  }

  if (host === "music.youtube.com") {
    // Only the artist form has been seen in real MusicBrainz answers (docs/pilote/decisions.md).
    const match = /^\/channel\/(UC[A-Za-z0-9_-]{22})$/.exec(path);
    if (!match || kind !== "artist") return null;
    return { service: "youtubeMusic", url: `https://music.youtube.com/channel/${match[1]}` };
  }

  const bandcamp = /^([a-z0-9-]+)\.bandcamp\.com$/.exec(host);
  if (bandcamp && bandcamp[1] !== "www" && bandcamp[1] !== "daily") {
    const base = `https://${bandcamp[1]}.bandcamp.com`;
    if (kind === "artist") return path === "/" ? { service: "bandcamp", url: `${base}/` } : null;
    const match = /^\/(album|track)\/([a-z0-9-]+)$/.exec(path);
    if (!match || match[1] !== (kind === "release" ? "album" : "track")) return null;
    return { service: "bandcamp", url: `${base}/${match[1]}/${match[2]}` };
  }

  return null;
}

/** One direct link per service: the first valid one in the order of the answer. */
export function pickListenLinks(
  relations: ProviderUrlRelation[],
  kind: ListenKind,
): ValidListenUrl[] {
  const picked = new Map<ListenService, string>();
  for (const relation of relations) {
    if (
      !LINK_TYPES.has(relation.type) &&
      !(kind === "artist" && ARTIST_LINK_TYPES.has(relation.type))
    ) {
      continue;
    }
    const valid = validListenUrl(relation.url, kind);
    if (valid && !picked.has(valid.service)) picked.set(valid.service, valid.url);
  }
  return [...picked].map(([service, url]) => ({ service, url }));
}

/** Search URL of each service for "first credited artist + title" (an artist page: its name). */
function searchUrl(service: ListenService, query: string): string {
  const q = encodeURIComponent(query);
  switch (service) {
    case "spotify":
      return `https://open.spotify.com/search/${q}`;
    case "deezer":
      return `https://www.deezer.com/search/${q}`;
    case "appleMusic":
      return `https://music.apple.com/search?term=${q}`;
    case "youtubeMusic":
      return `https://music.youtube.com/search?q=${q}`;
    case "bandcamp":
      return `https://bandcamp.com/search?q=${q}`;
  }
}

/**
 * The five "Listen on" links in display order: the stored direct link when it still passes
 * validation for that service, the search link otherwise.
 */
export function buildListenLinks(
  stored: { service: string; url: string }[],
  kind: ListenKind,
  title: string,
  firstArtist: string | null | undefined,
): ListenLink[] {
  const query = [firstArtist, title].filter(Boolean).join(" ");
  return LISTEN_SERVICES.map((service) => {
    for (const row of stored) {
      if (listenServiceFromDb(row.service) !== service) continue;
      const valid = validListenUrl(row.url, kind);
      if (valid?.service === service) return { service, url: valid.url, direct: true };
    }
    return { service, url: searchUrl(service, query), direct: false };
  });
}
