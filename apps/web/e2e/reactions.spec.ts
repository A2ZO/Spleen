import { expect, test, type Locator, type Page } from "./fixtures";

import {
  actionAnswered,
  exhaustRateLimit,
  failActions,
  holdActions,
  signUp,
  suspendInDatabase,
  trackActions,
  waitForHydration,
} from "./helpers";

/*
 * Reactions show at once and roll back with a message (`lib/use-instant-writes.ts`). Accounts
 * are left to the global teardown. The demo review, list and member are shared by parallel
 * tests: counts are compared with the value read just before the click.
 */

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const REVIEW = "/fr/review/00000000-0000-4000-8000-000000000507";
const LIST = "/fr/list/00000000-0000-4000-8000-000000043000";
const ALBUM = "/fr/album/nocturnes-pour-pluie-fine";
const UNKNOWN = "Quelque chose s'est mal passé. Réessaie.";

const pressed = (button: Locator, value: boolean) =>
  expect(button).toHaveAttribute("aria-pressed", String(value));

/** Reads the number in `locator`'s text. */
async function numberIn(locator: Locator) {
  return Number((await locator.innerText()).match(/\d+/)?.[0] ?? 0);
}

/**
 * The same checks for every toggle, starting off: shown before the answer (with its count),
 * rolled back on a 500, rapid clicks grouped, a click during a request sent after it.
 */
async function checkToggle(page: Page, button: Locator, count?: Locator) {
  await waitForHydration(page);
  const actions = trackActions(page);

  // 1. Answer held: the state and the count have already moved; saved once released.
  const before = count ? await numberIn(count) : 0;
  let release = await holdActions(page);
  await button.click();
  await pressed(button, true);
  if (count) expect(await numberIn(count)).toBe(before + 1);
  await release();
  await actions.settled(1);

  // 2. Server down: back to the state before, a message, the page still works.
  const undo = await failActions(page);
  await button.click();
  await pressed(button, false);
  await expect(page.getByText(UNKNOWN)).toBeVisible();
  await pressed(button, true);
  await undo();

  // 3. Double click (two clicks, re-aimed: the label may change width): nothing sent. Three
  // clicks: one request, the last value.
  const sent = actions.sent();
  await button.click();
  await button.click();
  await expect(page.getByText(UNKNOWN)).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(actions.sent()).toBe(sent);
  await button.click();
  await button.click();
  await button.click();
  await pressed(button, false);
  await actions.settled(sent + 1);

  // 4. A click while a request runs: sent after its answer, one more request.
  release = await holdActions(page);
  await button.click();
  await expect.poll(actions.sent).toBe(sent + 2);
  await button.click();
  await pressed(button, false);
  await release();
  await actions.settled(sent + 3);

  await page.reload();
  await pressed(button, false);
}

test("liking a review", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Lectrice");
  await page.goto(REVIEW);
  const button = page.getByRole("button", { name: /^J'aime/ });
  await checkToggle(page, button, button);
});

test("liking a list", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Curieux");
  await page.goto(LIST);
  const button = page.getByRole("button", { name: /^J'aime/ });
  await checkToggle(page, button, button);
});

test("following a member moves the follower count at once", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Suiveuse");
  await page.goto("/fr/u/vinylvince");
  await checkToggle(
    page,
    page.getByRole("button", { name: /suivre Vince$/i }),
    page.getByRole("link", { name: /abonnés?$/ }),
  );
});

test("the heart of the listen panel", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Cœur d'artichaut");
  await page.goto(ALBUM);
  const panel = page.getByRole("region", { name: "Ton écoute" });
  await checkToggle(page, panel.getByRole("button", { name: "Coup de cœur" }));
});

test("« À écouter » of the listen panel", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Patiente");
  await page.goto(ALBUM);
  const panel = page.getByRole("region", { name: "Ton écoute" });
  await checkToggle(page, panel.getByRole("button", { name: "À écouter" }));
});

test("the quick rating: shown at once, grouped, rolled back", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Notatrice");
  await page.goto(ALBUM);
  await waitForHydration(page);
  const panel = page.getByRole("region", { name: "Ton écoute" });
  const slider = panel.getByRole("slider", { name: "Ta note" });
  const value = (v: number) => expect(slider).toHaveAttribute("aria-valuenow", String(v));
  const actions = trackActions(page);

  // Held: the stars and "listened" show before the answer.
  let release = await holdActions(page);
  await slider.focus();
  await page.keyboard.press("End");
  await value(10);
  await pressed(panel.getByRole("button", { name: "Écouté", exact: true }), true);
  await release();
  await actions.settled(1);

  // Server down: back to 5 stars, with a message.
  const undo = await failActions(page);
  await page.keyboard.press("ArrowLeft");
  await value(9);
  await expect(panel.getByText(UNKNOWN)).toBeVisible();
  await value(10);
  await undo();

  // Back and forth: nothing sent. Three steps: one request.
  const sent = actions.sent();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  expect(actions.sent()).toBe(sent);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await value(7);
  await actions.settled(sent + 1);

  // During a request: the next rating leaves after its answer.
  release = await holdActions(page);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(actions.sent).toBe(sent + 2);
  await page.keyboard.press("ArrowLeft");
  await release();
  await actions.settled(sent + 3);
  await page.reload();
  await value(5);
});

test("a heart then an internal link right away is still saved", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Pressée");
  await page.goto(ALBUM);
  await waitForHydration(page);
  const heart = page.getByRole("region", { name: "Ton écoute" }).getByRole("button", {
    name: "Coup de cœur",
  });
  const answered = actionAnswered(page);
  await heart.click();
  await page.getByRole("main").getByRole("link", { name: "Lune Basse" }).first().click();
  await expect(page).toHaveURL(/\/fr\/artist\//);
  await answered;
  await page.goto(ALBUM);
  await pressed(heart, true);
});

test("real refusals: too many writes, then a suspended account", async ({ page }, testInfo) => {
  const username = await signUp(page, testInfo, "Infatigable");
  await page.goto(ALBUM);
  await waitForHydration(page);
  test.skip(!(await exhaustRateLimit(username, "listen-write")), "needs the dev server's Postgres");
  const heart = page.getByRole("region", { name: "Ton écoute" }).getByRole("button", {
    name: "Coup de cœur",
  });
  await heart.click();
  await pressed(heart, true);
  await expect(page.getByText("Trop de tentatives. Réessaie un peu plus tard.")).toBeVisible();
  await pressed(heart, false);

  await page.goto(REVIEW);
  await waitForHydration(page);
  await suspendInDatabase(username);
  const like = page.getByRole("button", { name: /^J'aime/ });
  await like.click();
  await expect(page.getByText("Ton compte est suspendu.")).toBeVisible();
  await pressed(like, false);
});

test("following a member who blocked you meanwhile is refused", async ({ browser }, testInfo) => {
  const [alice, bob] = [await browser.newPage(), await browser.newPage()];
  const [aliceName, bobName] = await Promise.all([
    signUp(alice, testInfo, "Alice Nocturne"),
    signUp(bob, testInfo, "Bob Sillon"),
  ]);
  await bob.goto(`/fr/u/${aliceName}`);
  await waitForHydration(bob);

  await alice.goto(`/fr/u/${bobName}`);
  await expect(async () => {
    await alice.getByRole("button", { name: "Plus d'actions pour Bob Sillon" }).click();
    await expect(alice.getByRole("button", { name: "Bloquer" })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await alice.getByRole("button", { name: "Bloquer" }).click();
  await alice.getByRole("dialog").getByRole("button", { name: "Bloquer" }).click();
  await expect(alice.getByRole("dialog")).toBeHidden();

  const follow = bob.getByRole("button", { name: /suivre Alice Nocturne$/i });
  await follow.click();
  await expect(bob.getByText("Action impossible.")).toBeVisible();
  await pressed(follow, false);
  await expect(bob.getByRole("link", { name: "0 abonné" })).toBeVisible();
});
