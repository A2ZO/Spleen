import { expect, test } from "@playwright/test";

// Runs on the demo seed only (no MusicBrainz call): fictional artists and albums.
test.use({ locale: "fr-FR" });

test("header search opens the results, accents and case ignored", async ({ page }) => {
  await page.goto("/fr");
  const search = page.getByRole("searchbox", { name: "Rechercher" });
  await search.fill("BETON velours");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/fr\/search\?q=BETON\+velours/);
  await expect(page.getByRole("link", { name: "Béton velours" })).toBeVisible();
});

test("results update while typing, and visitors are invited to sign in to add", async ({
  page,
}) => {
  await page.goto("/fr/search");
  await page.getByRole("searchbox", { name: "Rechercher" }).fill("lune basse");
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

test("unknown artist and track pages are 404", async ({ page }) => {
  for (const path of ["/fr/artist/nobody-here", "/fr/track/nothing-here"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});
