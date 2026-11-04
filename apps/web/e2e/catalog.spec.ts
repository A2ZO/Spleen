import { expect, test } from "./fixtures";

// Runs on the demo seed only (no MusicBrainz call): fictional artists and albums.
test.use({ locale: "fr-FR" });

test("header search opens the results, accents and case ignored", async ({ page, isMobile }) => {
  await page.goto("/fr");
  if (isMobile) {
    // Phones get a search icon leading to the search page and its full-width field.
    await page.getByRole("link", { name: "Rechercher" }).click();
    await page.getByRole("searchbox", { name: "Rechercher dans Spleen" }).fill("BETON velours");
    await expect(page).toHaveURL(/\/fr\/search\?q=BETON\+velours/);
  } else {
    const search = page.getByRole("searchbox", { name: "Rechercher", exact: true });
    await search.fill("BETON velours");
    await search.press("Enter");
    await expect(page).toHaveURL(/\/fr\/search\?q=BETON\+velours/);
  }
  const releases = page.getByRole("region", { name: "Albums, EP et singles" });
  await expect(releases.getByRole("link", { name: "Béton velours" })).toBeVisible();
});

test("results update while typing, and visitors are invited to sign in to add", async ({
  page,
}) => {
  await page.goto("/fr/search");
  await page.getByRole("searchbox", { name: "Rechercher dans Spleen" }).fill("lune basse");
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
