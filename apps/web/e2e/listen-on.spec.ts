import { expect, test } from "./fixtures";

import { throwawayListenPages } from "./helpers";

// "Listen on" (milestone 13): direct links stored for a throwaway album, artist and track,
// searches for the other services. Visitor only: the block is the same for everyone.
test.use({ locale: "fr-FR" });

test("album, artist and track pages link straight to the known services, search elsewhere", async ({
  page,
}, testInfo) => {
  const pages = await throwawayListenPages(testInfo);
  test.skip(!pages, "needs the Postgres database of the dev server");
  const { release, artist, track } = pages!;
  const block = () => page.getByRole("region", { name: "Écouter sur" });
  const link = (name: string) => block().getByRole("link", { name, exact: true });

  await page.goto(`/fr/album/${release.slug}`);
  await expect(link("Spotify")).toHaveAttribute(
    "href",
    "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7",
  );
  await expect(link("Spotify")).toHaveAttribute("rel", "nofollow noopener noreferrer");
  await expect(link("Bandcamp")).toHaveAttribute(
    "href",
    "https://charlixcx.bandcamp.com/album/brat",
  );
  const query = encodeURIComponent(`${artist.name} ${release.title}`);
  await expect(link("Deezer (recherche)")).toHaveAttribute(
    "href",
    `https://www.deezer.com/search/${query}`,
  );
  await expect(link("Apple Music (recherche)")).toHaveAttribute(
    "href",
    `https://music.apple.com/search?term=${query}`,
  );
  await expect(link("YouTube Music (recherche)")).toHaveAttribute(
    "href",
    `https://music.youtube.com/search?q=${query}`,
  );

  await page.goto(`/fr/artist/${artist.slug}`);
  await expect(link("Deezer")).toHaveAttribute("href", "https://www.deezer.com/artist/13820325");
  await expect(link("Spotify (recherche)")).toHaveAttribute(
    "href",
    `https://open.spotify.com/search/${encodeURIComponent(artist.name)}`,
  );

  await page.goto(`/fr/track/${track.slug}`);
  await expect(link("Apple Music")).toHaveAttribute(
    "href",
    "https://music.apple.com/de/song/1739079976",
  );
  await expect(link("Bandcamp (recherche)")).toHaveAttribute(
    "href",
    `https://bandcamp.com/search?q=${encodeURIComponent(`${artist.name} ${track.title}`)}`,
  );
});
