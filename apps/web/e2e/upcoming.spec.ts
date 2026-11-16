import { expect, test } from "./fixtures";

import { actionAnswered, signUp, throwawayCatalog, waitForHydration } from "./helpers";

// Upcoming releases (milestone 11). Dates are relative to today (no dependency on the seed's
// day); the throwaway artist and releases stay in the catalog, which is never cleaned.
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const NEEDS_POSTGRES = "needs the Postgres database of the dev server";

test("a visitor is sent to sign-in from « Mes sorties à venir »", async ({ page }) => {
  await page.goto("/fr/upcoming");
  await expect(page).toHaveURL(/\/fr\/sign-in/);
});

test("a follower finds the artist's next records, filters them, and the artist page lists them", async ({
  page,
  browser,
}, testInfo) => {
  const catalog = await throwawayCatalog(
    testInfo,
    [{ type: "ep", date: { inDays: 3 } }, { date: "nextYear" }],
    true,
  );
  test.skip(!catalog, NEEDS_POSTGRES);
  const { artist, releases } = catalog!;
  const [ep, album] = releases;

  // A visitor sees « À venir » on the artist page.
  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await visitor.goto(`/fr/artist/${artist!.slug}`);
  const coming = visitor.getByRole("region", { name: "À venir" });
  await expect(coming.getByRole("link", { name: ep!.title })).toBeVisible();
  await expect(coming.getByRole("link", { name: album!.title })).toBeVisible();
  await visitor.context().close();

  await signUp(page, testInfo, "Guetteuse");
  await page.goto("/fr/upcoming");
  await expect(page.getByText("Suis tes artistes depuis leur fiche")).toBeVisible();
  await page.goto(`/fr/artist/${artist!.slug}`);
  await waitForHydration(page);
  const followed = actionAnswered(page);
  await page.getByRole("button", { name: `Suivre ${artist!.name}` }).click();
  await followed;

  await page.goto("/fr/upcoming");
  const week = page.getByRole("region", { name: "Cette semaine" });
  await expect(week.getByRole("link", { name: ep!.title })).toBeVisible();
  const later = page.getByRole("region", { name: "Date à confirmer" });
  await expect(later.getByRole("link", { name: album!.title })).toBeVisible();

  await page.getByRole("link", { name: "EP", exact: true }).click();
  await expect(page).toHaveURL(/type=ep/);
  await expect(page.getByRole("link", { name: ep!.title })).toBeVisible();
  await expect(page.getByRole("link", { name: album!.title })).toHaveCount(0);
});

test("a record not out yet offers « À écouter » but no listen", async ({ page }, testInfo) => {
  const catalog = await throwawayCatalog(testInfo, [{ date: { inDays: 20 } }], true);
  test.skip(!catalog, NEEDS_POSTGRES);
  const [record] = catalog!.releases;

  await signUp(page, testInfo, "Patiente");
  await page.goto(`/fr/album/${record!.slug}`);
  await expect(page.getByText(/^Sort le /)).toBeVisible();
  await expect(page.getByRole("button", { name: "J'ai écouté" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Coup de cœur" })).toHaveCount(0);
  await waitForHydration(page);
  const queue = page.getByRole("button", { name: "À écouter" });
  const saved = actionAnswered(page);
  await queue.click();
  await expect(queue).toHaveAttribute("aria-pressed", "true");
  await saved;
  await page.reload();
  await expect(page.getByRole("button", { name: "À écouter" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
