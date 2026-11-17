import { expect, test, type Page } from "./fixtures";

import { followMembersInDatabase, signUp } from "./helpers";

// « Tes amis sur ce disque » (milestone 13, step 4), on the demo record of `seed/friends.ts`:
// six followed members shown, one with a private diary left out.
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const NEEDS_POSTGRES = "needs the Postgres database of the dev server";
const ALBUM = "/fr/album/dernier-metro-pour-belleville";
const TITLE = "Tes amis sur ce disque";
const FRIENDS = [
  "metrominuit",
  "quaidelaloire",
  "ticketchoc",
  "bellevilleblues",
  "contrebandiere",
  "derniertrain",
  "journalsecret",
];

const section = (page: Page) => page.getByRole("region", { name: TITLE });

test("a visitor sees no section, even with ?friends=all", async ({ page }) => {
  await page.goto(`${ALBUM}?friends=all`);
  await expect(page.getByRole("heading", { name: "Liste des titres" })).toBeVisible();
  await expect(page.getByRole("heading", { name: TITLE })).toHaveCount(0);
});

test("a member sees their friends' ratings and hearts, five then all", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Ami Curieux");
  await page.goto(ALBUM);
  await expect(page.getByRole("heading", { name: "Liste des titres" })).toBeVisible();
  await expect(page.getByRole("heading", { name: TITLE })).toHaveCount(0);

  test.skip(!(await followMembersInDatabase(username, FRIENDS)), NEEDS_POSTGRES);
  await page.reload();
  const friends = section(page);
  await expect(friends.getByRole("listitem")).toHaveCount(5);
  await expect(friends.getByRole("link", { name: "Salomé" })).toBeVisible();
  await expect(friends.getByRole("img", { name: "Coup de cœur" }).first()).toBeVisible();
  await friends.getByRole("link", { name: "Voir tous tes amis (6)" }).click();
  await expect(page).toHaveURL(/friends=all/);
  await expect(friends.getByRole("listitem")).toHaveCount(6);
  await expect(friends.getByText("Anouk")).toHaveCount(0);
  await friends.getByRole("link", { name: "Voir moins" }).click();
  await expect(friends.getByRole("listitem")).toHaveCount(5);
});

test("the full list opens without JavaScript", async ({ page, browser }, testInfo) => {
  const username = await signUp(page, testInfo, "Ami Sans Script");
  test.skip(!(await followMembersInDatabase(username, FRIENDS)), NEEDS_POSTGRES);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    storageState: await page.context().storageState(),
  });
  const noJs = await context.newPage();
  await noJs.goto(ALBUM);
  await section(noJs).getByRole("link", { name: "Voir tous tes amis (6)" }).click();
  await expect(section(noJs).getByRole("listitem")).toHaveCount(6);
  await expect(section(noJs).getByRole("link", { name: "Voir moins" })).toBeVisible();
  await context.close();
});
