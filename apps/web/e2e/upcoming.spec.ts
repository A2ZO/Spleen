import { todayIn } from "@spleen/validators";

import { expect, test } from "./fixtures";

import {
  actionAnswered,
  notifyReleasesInDatabase,
  signUp,
  throwawayCatalog,
  waitForHydration,
} from "./helpers";

// Upcoming releases (milestone 11). Dates are relative to today (no dependency on the seed's
// day); the throwaway artist and releases stay in the catalog, which is never cleaned.
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const NEEDS_POSTGRES = "needs the Postgres database of the dev server";
const REVIEWS_ON_RELEASE = "Les critiques ouvriront le jour de la sortie.";

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
  const later = page.getByRole("region", { name: "Annoncé, date à préciser" });
  await expect(later.getByRole("link", { name: album!.title })).toBeVisible();

  await page.getByRole("link", { name: "EP", exact: true }).click();
  await expect(page).toHaveURL(/type=ep/);
  await expect(page.getByRole("link", { name: ep!.title })).toBeVisible();
  await expect(page.getByRole("link", { name: album!.title })).toHaveCount(0);
});

test("a record not out yet offers « À écouter » but no listen", async ({
  page,
  browser,
}, testInfo) => {
  const catalog = await throwawayCatalog(testInfo, [{ date: { inDays: 20 } }], true);
  test.skip(!catalog, NEEDS_POSTGRES);
  const [record] = catalog!.releases;

  // A visitor is offered « À écouter », not a listen.
  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await visitor.goto(`/fr/album/${record!.slug}`);
  await expect(visitor.getByText("Connecte-toi pour l'ajouter à « À écouter ».")).toBeVisible();
  // No average before the release, and reviews wait for the day.
  await expect(visitor.getByText(REVIEWS_ON_RELEASE)).toBeVisible();
  await expect(visitor.getByText("Note de la communauté")).toHaveCount(0);
  await visitor.context().close();

  await signUp(page, testInfo, "Patiente");
  await page.goto(`/fr/album/${record!.slug}`);
  await expect(page.getByText(/^Sort le /)).toBeVisible();
  await expect(page.getByRole("button", { name: "J'ai écouté" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Coup de cœur" })).toHaveCount(0);
  await expect(page.getByText(REVIEWS_ON_RELEASE)).toBeVisible();
  await expect(page.getByText("Note de la communauté")).toHaveCount(0);
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

test("the home page announces tomorrow's record to its follower, not to a visitor", async ({
  page,
  browser,
}, testInfo) => {
  const catalog = await throwawayCatalog(testInfo, [{ date: { inDays: 1 } }], true);
  test.skip(!catalog, NEEDS_POSTGRES);
  const { artist, releases } = catalog!;
  const [record] = releases;

  await signUp(page, testInfo, "Impatiente");
  await page.goto("/fr");
  const soon = page.getByRole("region", { name: "Bientôt dans tes oreilles" });
  await expect(soon.getByText("Suis tes artistes depuis leur fiche")).toBeVisible();
  await page.goto(`/fr/artist/${artist!.slug}`);
  await waitForHydration(page);
  const followed = actionAnswered(page);
  await page.getByRole("button", { name: `Suivre ${artist!.name}` }).click();
  await followed;

  await page.goto("/fr");
  await expect(soon.getByRole("link", { name: record!.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sort demain" })).toBeVisible();

  const visitor = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  await visitor.goto("/fr");
  await expect(visitor.locator("h1")).toBeVisible();
  await expect(visitor.getByRole("heading", { name: "Sort demain" })).toHaveCount(0);
  await expect(visitor.getByRole("region", { name: "Bientôt dans tes oreilles" })).toHaveCount(0);
  await visitor.context().close();
});

test("the notifications page announces today's records of the artists a member follows", async ({
  page,
}, testInfo) => {
  // One `now` for the records' day and the nightly run: stable around midnight.
  const now = new Date();
  const today = { date: { inDays: 0 } };
  const single = await throwawayCatalog(testInfo, [today], true, now);
  test.skip(!single, NEEDS_POSTGRES);
  const four = (await throwawayCatalog(testInfo, [today, today, today, today], true, now))!;
  const username = await signUp(page, testInfo, "Matinale");

  await notifyReleasesInDatabase(username, [single!.artist!.slug], now);
  await page.goto("/fr/notifications");
  const record = single!.releases[0]!;
  const card = page.getByRole("link", {
    name: `Sortie aujourd'hui : ${record.title} de ${single!.artist!.name}`,
    exact: false,
  });
  await expect(card).toBeVisible();

  // A second followed artist's records the same day join the same notification.
  await notifyReleasesInDatabase(username, [four.artist!.slug], now);
  await page.reload();
  const group = page.getByRole("listitem").filter({ hasText: "5 sorties aujourd'hui" });
  await expect(group.getByRole("link")).toHaveCount(3);
  await expect(group.getByText("et 2 autres")).toBeVisible();
  await group.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/fr\/album\/e2e-/);
});

test("a release notification read days later names its day", async ({ page }, testInfo) => {
  // The nightly run happened 3 days ago: the records are of that day in Paris (the member's
  // zone), and the page reads it today.
  const now = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const day = todayIn("Europe/Paris", now);
  const thisYear = todayIn("Europe/Paris", new Date()).slice(0, 4);
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    ...(day.slice(0, 4) !== thisYear && { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  const that = { date: { inDays: 0 } };
  const single = await throwawayCatalog(testInfo, [that], true, now);
  test.skip(!single, NEEDS_POSTGRES);
  const four = (await throwawayCatalog(testInfo, [that, that, that, that], true, now))!;
  const username = await signUp(page, testInfo, "Distraite");

  await notifyReleasesInDatabase(username, [single!.artist!.slug], now);
  await page.goto("/fr/notifications");
  const record = single!.releases[0]!;
  await expect(
    page.getByRole("link", {
      name: `Sorti le ${date} : ${record.title} de ${single!.artist!.name}`,
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("Sortie aujourd'hui")).toHaveCount(0);

  await notifyReleasesInDatabase(username, [four.artist!.slug], now);
  await page.reload();
  const group = page
    .getByRole("listitem")
    .filter({ hasText: `5 sorties le ${date} chez tes artistes` });
  await expect(group.getByRole("link")).toHaveCount(3);
  await expect(group.getByText("et 2 autres")).toBeVisible();
});
