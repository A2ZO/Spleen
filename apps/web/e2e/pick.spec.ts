import { expect, test, type Page } from "./fixtures";

import { actionAnswered, signUp, waitForHydration } from "./helpers";

// « Tire un disque » (milestone 13, step 5), with two demo records of `seed/pick.ts` added to a
// throwaway account's « À écouter » list: an EP and a single.
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const EP = { slug: "tarmac", title: "Tarmac" };
const SINGLE = { slug: "origami-weather", title: "Origami Weather" };
const TITLES = [EP.title, SINGLE.title];
const ONLY_ONE = "C'est le seul disque de ta liste qui correspond.";

/** Title of the record drawn (the only heading of the card holding a link). */
const drawn = (page: Page) => page.locator("main h2 a").first().innerText();

async function queue(page: Page, slug: string) {
  await page.goto(`/fr/album/${slug}`);
  await waitForHydration(page);
  const answered = actionAnswered(page);
  await page
    .getByRole("region", { name: "Ton écoute" })
    .getByRole("button", { name: "À écouter" })
    .click();
  await answered;
}

test("a visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/fr/pick");
  await expect(page).toHaveURL(/\/fr\/sign-in/);
});

// The second button of the member home's lilac block (milestone 14, step 1); visitors keep
// « Trouver quoi écouter ».
test("the member home links to the draw, the visitor home to discover", async ({
  page,
  browser,
}, testInfo) => {
  await signUp(page, testInfo, "Hasard");
  await page.goto("/fr");
  const pick = page.getByRole("link", { name: "Tire un disque au hasard", exact: true });
  await expect(pick).toHaveAttribute("href", "/fr/pick");
  await pick.click();
  await expect(page).toHaveURL(/\/fr\/pick$/);
  await expect(page.getByText("Ta liste « À écouter » est vide.")).toBeVisible();

  const visitor = await browser.newPage({ locale: "fr-FR" });
  await visitor.goto("/fr");
  await expect(
    visitor.getByRole("link", { name: "Tire un disque au hasard", exact: true }),
  ).toHaveCount(0);
  await expect(
    visitor.getByRole("link", { name: "Trouver quoi écouter", exact: true }),
  ).toHaveAttribute("href", "/fr/discover");
  await visitor.close();
});

test("a member draws from their list, filters, draws another, even without JavaScript", async ({
  page,
  browser,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Tireuse");
  const tab = `/fr/u/${username}?tab=to-listen`;
  const button = page.getByRole("link", { name: "Tire un disque", exact: true });

  // Empty list: an invitation, no filters, no button on my tab.
  await page.goto("/fr/pick");
  await expect(page.getByText("Ta liste « À écouter » est vide.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Découvrir des disques" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Durée" })).toHaveCount(0);
  await page.goto(tab);
  await expect(page.getByText("Rien en attente sur la platine.")).toBeVisible();
  await expect(button).toHaveCount(0);

  await queue(page, EP.slug);
  await queue(page, SINGLE.slug);
  await page.goto(tab);
  await button.click();
  await expect(page).toHaveURL(/\/fr\/pick$/);
  expect(TITLES).toContain(await drawn(page));

  // One EP only: it is drawn, with the sentence instead of « Un autre ».
  await page.goto("/fr/pick?type=ep");
  await expect(page.getByRole("heading", { level: 2, name: EP.title })).toBeVisible();
  await expect(page.getByText(ONLY_ONE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Un autre" })).toHaveCount(0);

  // « Un autre » draws the other record.
  await page.goto("/fr/pick");
  await waitForHydration(page);
  const first = await drawn(page);
  await page.getByRole("button", { name: "Un autre" }).click();
  await expect(page).toHaveURL(/not=/);
  const other = TITLES.find((title) => title !== first)!;
  await expect(page.getByRole("heading", { level: 2, name: other })).toBeVisible();

  // Without JavaScript, the form still draws the other one.
  const context = await browser.newContext({
    javaScriptEnabled: false,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    storageState: await page.context().storageState(),
  });
  const noJs = await context.newPage();
  await noJs.goto("/fr/pick");
  const shown = await drawn(noJs);
  await noJs.getByRole("button", { name: "Un autre" }).click();
  const next = TITLES.find((title) => title !== shown)!;
  await expect(noJs.getByRole("heading", { level: 2, name: next })).toBeVisible();
  await context.close();

  // Someone else's list offers no draw.
  await page.goto("/fr/u/nuitblanche?tab=to-listen");
  await expect(page.getByRole("link", { name: "Gold Leaf Sessions" }).first()).toBeVisible();
  await expect(button).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // A member page, so here rather than in overflow.spec (run on the prod build, no sign-up).
  test("no horizontal overflow on the draw and on my tab", async ({ page }, testInfo) => {
    const noOverflow = async () => {
      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
    };
    // The demo record with the longest title, alone in the list.
    const username = await signUp(page, testInfo, "Étroite");
    // The member home: its lilac block now holds the longer « Tire un disque au hasard ».
    await page.goto("/fr");
    await expect(page.getByRole("link", { name: "Tire un disque au hasard" })).toBeVisible();
    await noOverflow();
    await queue(page, "long-way-to-kestrel-bay");
    await page.goto("/fr/pick");
    await expect(
      page.getByRole("heading", { level: 2, name: "Long Way to Kestrel Bay" }),
    ).toBeVisible();
    await expect(page.getByText(ONLY_ONE)).toBeVisible();
    await noOverflow();
    await page.goto(`/fr/u/${username}?tab=to-listen`);
    await expect(page.getByRole("link", { name: "Tire un disque", exact: true })).toBeVisible();
    await noOverflow();
  });
});
