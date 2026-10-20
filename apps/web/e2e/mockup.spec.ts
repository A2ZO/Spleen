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

test("album page shows the tracklist and a keyboard-accessible rating", async ({ page }) => {
  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nocturnes pour pluie fine");
  await expect(page.getByRole("heading", { name: "Liste des titres" })).toBeVisible();

  const slider = page.getByRole("slider", { name: "Ta note" });
  await slider.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuenow", "9");
});

test("profile page shows the shelf", async ({ page }) => {
  await page.goto("/fr/u/nuitblanche");
  await expect(page.getByRole("heading", { name: "L'Étagère" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Smoke Rings at 1 A\.M\./ }).first()).toBeVisible();
});

test("profile tabs switch to the stats panel", async ({ page }) => {
  await page.goto("/fr/u/nuitblanche");
  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Répartition des notes");
  await expect(page.getByRole("tabpanel")).toContainText("Top artistes 2026");
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
