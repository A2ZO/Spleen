import { expect, test, type Page } from "./fixtures";
import { waitForHydration } from "./helpers";

test.use({ locale: "fr-FR" });

const bar = (page: Page) => page.locator("[data-navigation-bar]");

/** Holds the page renders (RSC requests) under `path`: `ms` milliseconds, or forever. */
async function slowRenders(page: Page, path: string, ms?: number) {
  await page.route(
    (url) => url.pathname.startsWith(path),
    async (route) => {
      if (!route.request().headers().rsc) return route.continue();
      if (ms === undefined) return; // Never answered: the navigation must be replaced.
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    },
  );
}

// The top bar shows while a clicked link waits for a slow server, then goes once the page is in.
test("a slow navigation shows the top bar until the page arrives", async ({ page }) => {
  await page.goto("/fr");
  await waitForHydration(page);
  await expect(bar(page)).toHaveAttribute("data-navigation-bar", "hidden");

  await slowRenders(page, "/fr/album/", 1200);
  const album = page.locator('main a[href*="/album/"]').first();
  await album.click();
  await expect(bar(page)).toHaveAttribute("data-navigation-bar", "shown");
  await expect(page).toHaveURL(/\/fr\/album\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(bar(page)).toHaveAttribute("data-navigation-bar", "hidden");
});

test.describe("from code (useNavigate)", () => {
  test.skip(({ isMobile }) => isMobile, "the header field is the desktop search");

  async function searchFromHeader(page: Page) {
    await page.goto("/fr");
    await waitForHydration(page);
    const field = page.getByRole("combobox", { name: "Rechercher", exact: true });
    await field.fill("Béton");
    await field.press("Enter"); // router.push to /search
  }

  test("a slow push shows the bar until the page arrives", async ({ page }) => {
    await slowRenders(page, "/fr/search", 1200);
    await searchFromHeader(page);
    await expect(bar(page)).toHaveAttribute("data-navigation-bar", "shown");
    await expect(page).toHaveURL(/\/fr\/search\?q=/);
    await expect(bar(page)).toHaveAttribute("data-navigation-bar", "hidden");
  });

  test("a push replaced by a link never leaves the bar up", async ({ page }) => {
    await slowRenders(page, "/fr/search");
    await searchFromHeader(page);
    await expect(bar(page)).toHaveAttribute("data-navigation-bar", "shown");
    await page.locator('main a[href*="/album/"]').first().click();
    await expect(page).toHaveURL(/\/fr\/album\//);
    await expect(bar(page)).toHaveAttribute("data-navigation-bar", "hidden");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
});
