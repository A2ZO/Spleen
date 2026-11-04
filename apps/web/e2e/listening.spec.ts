import { expect, test } from "./fixtures";

import { deleteAccount, signUp } from "./helpers";

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

test("listen in one click, rate, log with a mood and find it in the diary", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Écouteur nocturne");

  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  const panel = page.getByRole("region", { name: "Ton écoute" });

  await panel.getByRole("button", { name: "J'ai écouté" }).click();
  await expect(panel.getByRole("button", { name: "Écouté", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByText("Tes écoutes")).toBeVisible();

  // Quick rating with the keyboard: 4.5 stars, kept after a reload.
  const slider = panel.getByRole("slider", { name: "Ta note" });
  await slider.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("aria-valuenow", "9");
  await expect(panel.getByText("Note rapide, sans date")).toBeVisible();
  await page.reload();
  await expect(panel.getByRole("slider", { name: "Ta note" })).toHaveAttribute(
    "aria-valuenow",
    "9",
  );

  // Full log: dated today by default, with a mood and a track rating.
  // After a reload the server HTML is visible before React hydrates: retry the first click.
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await panel.getByRole("button", { name: "Journaliser…" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(dialog.getByLabel("Date d'écoute")).not.toHaveValue("");
  await dialog.getByRole("button", { name: "Pluie sur la vitre" }).click();
  await dialog.getByLabel("Format").selectOption("vinyl");
  const track = dialog.getByRole("slider", { name: "Une heure du matin" });
  await track.focus();
  await page.keyboard.press("End");
  await expect(dialog.getByText("Suggestion d'après tes pistes : 5 ★")).toBeVisible();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/fr/u/${username}`);
  const diary = page.getByRole("region", { name: "Sections du profil" });
  await expect(
    diary.getByRole("link", { name: "Nocturnes pour pluie fine" }).first(),
  ).toBeVisible();
  await expect(diary.getByText("Pluie sur la vitre").first()).toBeVisible();

  await deleteAccount(page, username);
});
