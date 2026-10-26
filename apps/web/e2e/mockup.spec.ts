import { expect, test } from "@playwright/test";

test.describe("with a French browser", () => {
  test.use({ locale: "fr-FR" });

  test("root redirects to the French home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qu'as-tu écouté ce soir ?");
  });
});

test.describe("with an English browser", () => {
  test.use({ locale: "en-US" });

  test("root redirects to the English home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });
});

test("home page is available in English", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What did you listen to tonight?",
  );
});

test("album page shows the tracklist and invites visitors to sign in", async ({ page }) => {
  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nocturnes pour pluie fine");
  await expect(page.getByRole("heading", { name: "Liste des titres" })).toBeVisible();
  await expect(page.getByText("Connecte-toi pour garder une trace de tes écoutes.")).toBeVisible();
});

test("profile page shows the shelf", async ({ page }) => {
  await page.goto("/fr/u/nuitblanche");
  await expect(page.getByRole("heading", { name: "L'Étagère" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Smoke Rings at 1 A\.M\./ }).first()).toBeVisible();
});

test("profile tabs switch to the stats panel", async ({ page }) => {
  await page.goto("/fr/u/nuitblanche");
  const sections = page.getByRole("region", { name: "Sections du profil" });
  // Under load the click can land before hydration: retry it.
  await expect(async () => {
    await sections.getByRole("link", { name: "Stats" }).click();
    await expect(page).toHaveURL(/\?tab=stats$/, { timeout: 2_000 });
  }).toPass();
  await expect(sections).toContainText("Répartition des notes");
  await expect(sections).toContainText("Top artistes 2026");
  await expect(sections).toContainText("En écoutes, réécoutes comprises.");
});

test("diary calendar shows a month", async ({ page }) => {
  await page.goto("/fr/u/nuitblanche/diary");
  await page.getByRole("link", { name: "Calendrier" }).click();
  const caption = page.getByRole("table", { name: /^Écoutes de/ }).locator("caption");
  const shown = await caption.textContent();
  await page.getByRole("link", { name: /Mois précédent/ }).click();
  await expect(page).toHaveURL(/view=calendar&month=\d{4}-\d{2}/);
  // Wait for the new month: ending on the URL alone closed the page mid-render.
  await expect(caption).toHaveText(/^Écoutes de/);
  await expect(caption).not.toHaveText(shown ?? "");
});

test("hearts are paged, and a page past the last one goes to the last page", async ({ page }) => {
  await page.goto("/fr/u/fouilleuse?tab=likes");
  const sections = page.getByRole("region", { name: "Sections du profil" });
  await expect(sections.getByText("Page 1 sur 2")).toBeVisible();
  await sections.getByRole("link", { name: /Plus anciens/ }).click();
  await expect(page).toHaveURL(/tab=likes&page=2$/);
  await expect(sections.getByRole("link", { name: "Brume sur le canal" })).toBeVisible();
  await page.goto("/fr/u/fouilleuse?tab=likes&page=9");
  await expect(page).toHaveURL(/tab=likes&page=2$/);
});

test("switching language keeps the profile tab", async ({ page }) => {
  await page.goto("/fr/u/nuitblanche?tab=stats");
  // After a navigation the server HTML shows before React hydrates: retry the click.
  await expect(async () => {
    await page.getByRole("banner").getByRole("button", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/u\/nuitblanche\?tab=stats$/, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("region", { name: "Profile sections" })).toContainText(
    "Rating distribution",
  );
});

test("empty shelf gathers dust", async ({ page }) => {
  await page.goto("/fr/u/rainydaysam");
  await expect(page.getByText("L'étagère de Sam prend la poussière.")).toBeVisible();
});

test("theme toggle switches to cream paper", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: "Passer en mode papier crème" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("unknown pages show the Baudelaire 404", async ({ page }) => {
  const response = await page.goto("/fr/nulle-part");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Je suis comme le roi d'un pays pluvieux,")).toBeVisible();
});
