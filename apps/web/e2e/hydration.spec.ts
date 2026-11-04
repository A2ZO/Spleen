import { expect, test, type Page } from "./fixtures";
import { waitForHydration } from "./helpers";

test.use({ locale: "fr-FR" });

// Issue #24: text typed while the scripts are still loading (a slow phone) must survive
// hydration and reach the form's state.
async function openBeforeHydration(page: Page, url: string) {
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).not.toBeAttached();
}

test("an email typed before hydration is the one the link is sent to", async ({
  page,
}, testInfo) => {
  const email = `e2e-${Date.now().toString(36)}h${testInfo.project.name.slice(0, 1)}@example.test`;
  await openBeforeHydration(page, "/fr/sign-in");
  await page.getByLabel("Ton email").fill(email);
  await expect(page.locator("html[data-hydrated]")).not.toBeAttached();
  await waitForHydration(page);
  await page.getByRole("button", { name: "Recevoir mon lien" }).click();
  await expect(page.getByRole("heading", { name: "Regarde ta boîte mail" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("a search typed before hydration runs once React takes over", async ({ page }) => {
  await openBeforeHydration(page, "/fr/search");
  await page.getByLabel("Rechercher dans Spleen").fill("miles");
  await expect(page.locator("html[data-hydrated]")).not.toBeAttached();
  await waitForHydration(page);
  await expect(page).toHaveURL(/\/fr\/search\?q=miles$/);
  await expect(page.getByLabel("Rechercher dans Spleen")).toHaveValue("miles");
});
