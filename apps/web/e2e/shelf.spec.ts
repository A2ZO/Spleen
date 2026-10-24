import { expect, test } from "@playwright/test";

import { deleteAccount, signUp } from "./helpers";

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

test("put a record on the Shelf from its page, find it in Hearts, reorder it", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Collectionneuse");
  await expect(page.getByText("Ton étagère prend la poussière.")).toBeVisible();

  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  await page
    .getByRole("region", { name: "Ton écoute" })
    .getByRole("button", {
      name: "Coup de cœur",
    })
    .click();
  // The server HTML shows before hydration: retry the first click.
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Mettre sur mon Étagère" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByRole("button", { name: "Emplacement 2, libre" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Sur mon Étagère" })).toBeVisible();

  await page.goto(`/fr/u/${username}`);
  const shelf = page.getByRole("region", { name: "L'Étagère" });
  await expect(shelf.getByText("Mes 4 disques favoris")).toBeVisible();
  await expect(shelf.getByRole("link", { name: /Nocturnes pour pluie fine/ })).toBeVisible();

  await expect(async () => {
    await shelf.getByRole("button", { name: "Modifier mon Étagère" }).click();
    await expect(shelf.getByRole("list", { name: "Ordre de l'Étagère" })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass();
  await shelf
    .getByRole("button", { name: "Décaler « Nocturnes pour pluie fine » vers la gauche" })
    .click();
  await expect(shelf.getByRole("status")).toHaveText(
    "« Nocturnes pour pluie fine » est maintenant à la place 1.",
  );

  const sections = page.getByRole("region", { name: "Sections du profil" });
  await sections.getByRole("link", { name: "Coups de cœur" }).click();
  await expect(sections.getByRole("link", { name: "Nocturnes pour pluie fine" })).toBeVisible();
  await expect(sections.getByRole("button", { name: "Sur mon Étagère" })).toBeVisible();

  await deleteAccount(page, username);
});
