import { expect, test } from "./fixtures";
import { waitForHydration } from "./helpers";

test.use({ locale: "fr-FR" });

// The top bar shows while a clicked link waits for a slow server, then goes once the page is in.
test("a slow navigation shows the top bar until the page arrives", async ({ page }) => {
  await page.goto("/fr");
  await waitForHydration(page);
  const bar = page.locator("[data-navigation-bar]");
  await expect(bar).toHaveAttribute("data-navigation-bar", "hidden");

  await page.route("**/fr/album/**", async (route) => {
    if (route.request().headers().rsc) await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  const album = page.locator('main a[href*="/album/"]').first();
  await album.click();
  await expect(bar).toHaveAttribute("data-navigation-bar", "shown");
  await expect(page).toHaveURL(/\/fr\/album\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(bar).toHaveAttribute("data-navigation-bar", "hidden");
});
