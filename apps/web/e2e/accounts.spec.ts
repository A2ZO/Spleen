import { expect, test } from "@playwright/test";

import { deleteAccount, signUp } from "./helpers";

test.use({ locale: "fr-FR" });

test("sign up with a magic link, pick a username, edit and delete the account", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Testeur nocturne");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Testeur nocturne");

  await page.goto("/fr/settings");
  // 2×2 PNG: the browser crops/resizes it, the API checks its bytes, the page shows it.
  await page.getByLabel("Changer d'avatar").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.locator("#avatar ~ div img")).toHaveAttribute("src", /\/avatars\//);

  await page.getByLabel("Bio").fill("Du jazz, la nuit.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "C'est enregistré." })).toBeVisible();

  await deleteAccount(page, username);
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();

  const gone = await page.goto(`/fr/u/${username}`);
  expect(gone?.status()).toBe(404);
});

test("protected pages send visitors to the sign-in page", async ({ page }) => {
  await page.goto("/fr/settings");
  await expect(page).toHaveURL(/\/fr\/sign-in$/);
});
