import { expect, test } from "./fixtures";

test.use({ locale: "fr-FR", viewport: { width: 390, height: 844 } });

// Main pages a visitor reaches: none may scroll sideways on a phone (a 425 px column once did).
const PAGES = [
  "/fr",
  "/fr/discover",
  "/fr/search?q=pluie",
  "/fr/album/nocturnes-pour-pluie-fine",
  "/fr/artist/lune-basse",
  "/fr/review/00000000-0000-4000-8000-000000000507",
  "/fr/u/nuitblanche",
  "/fr/u/nuitblanche/diary",
  "/fr/list/00000000-0000-4000-8000-000000043002",
  "/fr/sign-in",
  "/fr/legal",
];

for (const path of PAGES) {
  test(`no horizontal overflow at 390 px on ${path}`, async ({ page }) => {
    await page.goto(path);
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });
}

test("no horizontal overflow at 390 px on a track page", async ({ page }) => {
  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  await page.locator('main a[href*="/track/"]').first().click();
  await expect(page).toHaveURL(/\/fr\/track\//);
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
});
