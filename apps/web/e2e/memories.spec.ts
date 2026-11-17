import { expect, test, type Page } from "./fixtures";

import {
  signUp,
  throwawayCatalog,
  throwawayFans,
  throwawayMemories,
  waitForHydration,
} from "./helpers";

// « Souvenirs » on the member home (milestone 14, step 3): a listen on this day 4 years ago and
// two records released on this day 20 and 12 years ago, hearted by a throwaway account. The
// data goes straight into the dev server's Postgres database (null on PGlite).
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const NEEDS_DB = "needs the Postgres database of the dev server";
const memories = (page: Page) => page.getByRole("region", { name: "Souvenirs" });

/** This month 4 years ago in Paris, as the diary's `month` parameter. */
function monthYearsAgo(years: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return `${Number(today.slice(0, 4)) - years}-${today.slice(5, 7)}`;
}

test("the home shows what was listened to and today's anniversaries", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Souvenance");
  const data = await throwawayMemories(testInfo, username, {
    listenedYearsAgo: 4,
    heartedYearsAgo: [20, 12],
  });
  test.skip(!data, NEEDS_DB);

  await page.goto("/fr");
  const section = memories(page);
  await expect(section.getByRole("heading", { name: "Il y a 4 ans, tu écoutais…" })).toBeVisible();
  await expect(section.getByRole("link", { name: data!.listened })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Anniversaires du jour" })).toBeVisible();
  const ages = section.getByText(/\d+ ans aujourd'hui/);
  await expect(ages).toHaveText(["20 ans aujourd'hui", "12 ans aujourd'hui"]);
  for (const { title } of data!.hearted) {
    await expect(section.getByRole("link", { name: title })).toBeVisible();
  }

  const diary = section.getByRole("link", { name: "Ouvrir ce mois dans mon journal" });
  await expect(diary).toHaveAttribute(
    "href",
    `/fr/u/${username}/diary?view=calendar&month=${monthYearsAgo(4)}`,
  );
});

test("the section is there without JavaScript, and the setting turns it off", async ({
  page,
  browser,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Mémoire");
  const data = await throwawayMemories(testInfo, username, {
    listenedYearsAgo: 4,
    heartedYearsAgo: [12],
  });
  test.skip(!data, NEEDS_DB);

  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    storageState: await page.context().storageState(),
  });
  const plain = await noJs.newPage();
  await plain.goto("/fr");
  await expect(memories(plain).getByRole("link", { name: data!.listened })).toBeVisible();
  await noJs.close();

  await page.goto("/fr/settings");
  await waitForHydration(page);
  const setting = page.getByRole("region", { name: "Souvenirs" });
  await setting.getByRole("checkbox", { name: "Afficher mes souvenirs sur l'accueil" }).uncheck();
  await setting.getByRole("button", { name: "Enregistrer" }).click();
  await expect(setting.getByText("C'est enregistré.")).toBeVisible();

  await page.goto("/fr");
  await expect(page.locator("main")).toBeVisible();
  await expect(memories(page)).toHaveCount(0);
});

test("no section without memories, nor for a visitor", async ({ page, browser }, testInfo) => {
  await signUp(page, testInfo, "Oubli");
  await page.goto("/fr");
  await expect(page.locator("main")).toBeVisible();
  await expect(memories(page)).toHaveCount(0);

  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await visitor.goto("/fr");
  await expect(visitor.locator("main")).toBeVisible();
  await expect(memories(visitor)).toHaveCount(0);
  await visitor.context().close();
});

// « Sortis un <jour mois> » on /discover (step 4): the same for every reader, Paris's day. Three
// fans put the 80-year-old record ahead of the dev database's two-member records.
test("/discover shows records members love, released on this day", async ({ page }, testInfo) => {
  const catalog = await throwawayCatalog(testInfo, [
    { date: { yearsAgo: 80 } },
    { date: { yearsAgo: 12 } },
  ]);
  test.skip(!catalog, NEEDS_DB);
  const [loved, alone] = catalog!.releases;
  await throwawayFans(testInfo, loved!.slug, 3);
  await throwawayFans(testInfo, alone!.slug, 1);

  await page.goto("/fr/discover");
  const section = page.getByRole("region", { name: /^Sortis un \d+ \S+$/ });
  await expect(section).toBeVisible();
  const tile = section.getByRole("listitem").filter({ hasText: loved!.title });
  await expect(tile.getByRole("link", { name: loved!.title })).toBeVisible();
  await expect(tile.getByText("80 ans aujourd'hui")).toBeVisible();
  await expect(section.getByText(alone!.title)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the home with memories does not overflow", async ({ page }, testInfo) => {
    const username = await signUp(page, testInfo, "Poche");
    const data = await throwawayMemories(testInfo, username, {
      listenedYearsAgo: 4,
      heartedYearsAgo: [20, 12],
    });
    test.skip(!data, NEEDS_DB);

    await page.goto("/fr");
    await expect(memories(page).getByRole("link", { name: data!.listened })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
