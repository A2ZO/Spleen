import { expect, test } from "./fixtures";

import { waitForHydration } from "./helpers";

// Runs on the demo seed only (no MusicBrainz call): fictional artists and albums.
test.use({ locale: "fr-FR" });

test("header search opens the results, accents and case ignored", async ({ page, isMobile }) => {
  await page.goto("/fr");
  await waitForHydration(page);
  // Phones get a search icon opening a full-screen search.
  if (isMobile) await page.getByRole("link", { name: "Rechercher" }).click();
  const search = page.getByRole("combobox", { name: "Rechercher", exact: true });
  await search.fill("BETON velours");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/fr\/search\?q=BETON\+velours/);
  const releases = page.getByRole("region", { name: "Albums, EP et singles" });
  await expect(releases.getByRole("link", { name: "Béton velours" })).toBeVisible();
});

test("the search page shows every result on Enter, visitors are invited to sign in", async ({
  page,
}) => {
  await page.goto("/fr/search");
  await waitForHydration(page);
  const field = page.getByRole("combobox", { name: "Rechercher dans Spleen" });
  await field.fill("lune basse");
  await field.press("Enter");
  await expect(page.getByRole("link", { name: /Lune Basse/ }).first()).toBeVisible();
  await expect(page).toHaveURL(/q=lune\+basse/);
  await expect(
    page.getByRole("link", { name: "Connecte-toi pour l'ajouter à Spleen" }),
  ).toHaveAttribute("href", "/fr/sign-in");
});

test("album → artist → track pages link to each other", async ({ page }) => {
  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  await page.getByRole("link", { name: "Vitre embuée" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vitre embuée");
  await expect(page.getByRole("heading", { name: "Apparaît sur" })).toBeVisible();

  await page.getByRole("link", { name: "Lune Basse" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lune Basse");
  await expect(page.getByRole("heading", { name: "Albums" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nocturnes pour pluie fine" })).toBeVisible();
});

test("unknown album, artist, track and profile pages are 404", async ({ page }) => {
  for (const path of [
    "/fr/album/nothing-here",
    "/fr/artist/nobody-here",
    "/fr/track/nothing-here",
    "/fr/u/nobody-here",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Demo seed: Les Fouilleurs has 30 albums, shown 12 at a time until "see all".
  test("an artist's albums show 12, then all of them through a plain link", async ({ page }) => {
    await page.goto("/fr/artist/les-fouilleurs");
    const albums = page.locator("section[aria-labelledby=albums] li");
    await expect(albums).toHaveCount(12);
    await page
      .getByRole("link", { name: /^Tout voir \(\d+\)$/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/fr\/artist\/les-fouilleurs\?all=albums#albums$/);
    expect(await albums.count()).toBeGreaterThan(12);
    await page.getByRole("link", { name: "Voir moins" }).click();
    await expect(albums).toHaveCount(12);
  });
});
