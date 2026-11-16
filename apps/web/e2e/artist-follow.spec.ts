import { expect, test } from "./fixtures";

import { actionAnswered, signUp, waitForHydration } from "./helpers";

// Following artists (milestone 11). Accounts are deleted by the global teardown (`cleanup.ts`).
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const ARTIST = "/fr/artist/lune-basse";
const NAME = "Lune Basse";

test("a member follows an artist, finds it in settings and unfollows it there", async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo, "Alice Nocturne");
  await page.goto(ARTIST);
  await waitForHydration(page);
  const saved = actionAnswered(page);
  await page.getByRole("button", { name: `Suivre ${NAME}` }).click();
  await expect(page.getByRole("button", { name: `Ne plus suivre ${NAME}` })).toBeVisible();
  await saved;

  await page.goto("/fr/settings");
  const section = page.getByRole("region", { name: "Sorties à venir" });
  await expect(section.getByLabel("Me prévenir le jour de la sortie")).toBeChecked();
  await expect(section.getByRole("link", { name: NAME })).toBeVisible();
  await waitForHydration(page);
  const unfollowed = actionAnswered(page);
  await section.getByRole("button", { name: `Ne plus suivre ${NAME}` }).click();
  await unfollowed;
  await expect(section.getByText("Tu ne suis aucun artiste pour l'instant.")).toBeVisible();
});

test("a visitor's follow link leads to sign-in", async ({ page }) => {
  await page.goto(ARTIST);
  await page.getByRole("link", { name: `Suivre ${NAME}` }).click();
  await expect(page).toHaveURL(/\/fr\/sign-in/);
});

test("the follow button works without JavaScript", async ({ page, browser }, testInfo) => {
  await signUp(page, testInfo, "Bob Sillon");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    storageState: await page.context().storageState(),
  });
  const noJs = await context.newPage();
  await noJs.goto(ARTIST);
  await noJs.getByRole("button", { name: `Suivre ${NAME}` }).click();
  await expect(noJs.getByRole("button", { name: `Ne plus suivre ${NAME}` })).toBeVisible();
  await context.close();
});
