import type { ListenLink } from "../types";

/** Plain search links to streaming services: no API, no account linking. */
export function buildListenLinks(title: string, artistNames: string[]): ListenLink[] {
  const query = encodeURIComponent([...artistNames, title].join(" "));
  return [
    { service: "spotify", url: `https://open.spotify.com/search/${query}` },
    { service: "deezer", url: `https://www.deezer.com/search/${query}` },
    { service: "appleMusic", url: `https://music.apple.com/search?term=${query}` },
    { service: "youtube", url: `https://www.youtube.com/results?search_query=${query}` },
  ];
}
