import { expect, test, type Page } from "@playwright/test";

import { deleteAccount, signUp } from "./helpers";

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

/** Opens "Add to a list" (the server HTML shows before hydration: retry the first click). */
async function openAddToList(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Ajouter à une liste" });
  await expect(async () => {
    await page.getByRole("button", { name: "Ajouter à une liste" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return dialog;
}

test("make a list from record pages and reorder it with the keyboard", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Listeuse");

  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  let dialog = await openAddToList(page);
  await dialog.getByLabel("Nouvelle liste").fill("Pluie fine");
  await dialog.getByRole("button", { name: "Créer et ajouter" }).click();
  await expect(dialog.getByRole("checkbox", { name: /Pluie fine/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Fermer" }).click();

  await page.goto("/fr/album/smoke-rings-at-1-am");
  dialog = await openAddToList(page);
  await dialog.getByRole("checkbox", { name: /Pluie fine/ }).check();
  await expect(dialog.getByText("Ajouté à « Pluie fine ».")).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).click();

  await page.goto(`/fr/u/${username}?tab=lists`);
  await page.getByRole("link", { name: "Pluie fine" }).click();
  const items = page.getByRole("list").filter({ hasText: "Nocturnes pour pluie fine" });
  await expect(items.getByRole("listitem").first()).toContainText("Nocturnes pour pluie fine");

  await page.getByRole("link", { name: "Modifier" }).click();
  const moveDown = page.getByRole("button", { name: "Descendre « Nocturnes pour pluie fine »" });
  await expect(async () => {
    await moveDown.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText(
      "« Nocturnes pour pluie fine » est maintenant en position 2.",
      { timeout: 1_000 },
    );
  }).toPass();
  // The focus stays with the moved record.
  await expect(
    page.getByRole("button", { name: "Monter « Nocturnes pour pluie fine »" }),
  ).toBeFocused();

  await expect(async () => {
    await page.goto(`/fr/u/${username}?tab=lists`);
    await page.getByRole("link", { name: "Pluie fine" }).click();
    await expect(
      page.getByRole("list").filter({ hasText: "Smoke Rings" }).getByRole("listitem").first(),
    ).toContainText("Smoke Rings at 1 A.M.", { timeout: 1_000 });
  }).toPass();

  await deleteAccount(page, username);
});

test("discover shows real charts without overflowing the screen", async ({ page }, testInfo) => {
  await page.goto("/fr/discover");
  await expect(page.getByRole("heading", { level: 1, name: "Découvrir" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tendances chez les membres francophones" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Les mieux notés" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("discover.png"), fullPage: true });

  await page.goto("/fr/list/00000000-0000-4000-8000-000000043000");
  await expect(page.getByRole("heading", { level: 1, name: "Late-night mixtape" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath("list.png"), fullPage: true });
});
