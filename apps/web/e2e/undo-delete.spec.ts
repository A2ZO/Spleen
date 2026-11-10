import { expect, test, type Locator, type Page } from "./fixtures";

import { actionAnswered, failActions, signUp, trackActions } from "./helpers";

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

/*
 * Deleting one's own list, review, comment or listen: hidden at once, "Annuler" for 8 s, sent at
 * the end (`lib/use-undoable-delete.ts`). The page clock is installed before the first page and
 * paused right before each deletion, so the delay only runs with `clock.runFor`.
 */

const ALBUM = "/fr/album/nocturnes-pour-pluie-fine";
const VINCE_REVIEW = "/fr/review/00000000-0000-4000-8000-000000000507";
const UNDO_MS = 8_000;

const banners = (page: Page) => page.getByRole("region", { name: "Suppressions à annuler" });

/** Stops the page clock: from now on timers only fire with `runFor`. */
async function pauseClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1_000));
}

/** Lets the delay run out and waits for the deletion's answer. */
async function endDelay(page: Page) {
  const answered = actionAnswered(page);
  await page.clock.runFor(UNDO_MS);
  await answered;
}

/** A click with the pointer, then the pointer away from the banners (hovering pauses them). */
async function clickAway(target: Locator) {
  await target.click();
  await target.page().mouse.move(0, 0);
}

/** Leaves through the header's home link (an internal navigation). */
async function goHome(page: Page) {
  await page
    .getByRole("banner")
    .getByRole("link", { name: /Accueil/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/fr$/);
}

// --- The four deletions: setup, delete, and the item to look for. -------------------------------

interface Case {
  name: string;
  /** Creates the item; returns where it is shown and the item itself. */
  setup: (page: Page, username: string) => Promise<{ url: string; item: Locator }>;
  /** Deletes it (pointer click); the page shows `url` afterwards. */
  remove: (page: Page) => Promise<void>;
  banner: string | RegExp;
}

async function newList(page: Page, username: string) {
  const title = `Pluie ${username}`;
  await page.goto("/fr/list/new");
  await page.getByLabel("Titre").fill(title);
  await page.getByRole("button", { name: "Créer la liste" }).click();
  await expect(page).toHaveURL(/\/list\/.+\/edit$/);
  return title;
}

/** Logs the album with a review; returns the review's text. */
async function newReview(page: Page, username: string) {
  const body = `Une pluie fine sur le zinc (${username}).`;
  await page.goto(ALBUM);
  const panel = page.getByRole("region", { name: "Ton écoute" });
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await panel.getByRole("button", { name: "Journaliser…" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByLabel("Critique (facultative)").fill(body);
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();
  return body;
}

async function newComment(page: Page, username: string) {
  const text = `Un commentaire à effacer (${username}).`;
  await page.goto(VINCE_REVIEW);
  await page.getByLabel("Ton commentaire").fill(text);
  await page.getByRole("button", { name: "Publier" }).click();
  const item = page.getByRole("listitem").filter({ hasText: text });
  await expect(item).toBeVisible();
  return item;
}

const panelOf = (page: Page) => page.getByRole("region", { name: "Ton écoute" });
const listenRow = (page: Page) =>
  panelOf(page).getByRole("button", { name: "Modifier", exact: true });

const cases: Case[] = [
  {
    name: "list",
    async setup(page, username) {
      const title = await newList(page, username);
      return {
        url: `/fr/u/${username}?tab=lists`,
        item: page.getByRole("main").getByRole("link", { name: title }),
      };
    },
    async remove(page) {
      await clickAway(page.getByRole("button", { name: "Supprimer la liste" }));
      await expect(page).toHaveURL(/tab=lists/);
    },
    banner: /Liste « Pluie .+ » supprimée/,
  },
  {
    name: "review",
    async setup(page, username) {
      const body = await newReview(page, username);
      const url = `/fr/u/${username}?tab=reviews`;
      await page.goto(url);
      const item = page.getByRole("main").getByText(body);
      await expect(item).toBeVisible();
      await page
        .getByRole("main")
        .getByRole("link", { name: "Modifier (Nocturnes pour pluie fine)" })
        .click();
      await expect(page).toHaveURL(/\/edit$/);
      return { url, item };
    },
    async remove(page) {
      await clickAway(page.getByRole("button", { name: "Supprimer la critique" }));
      await expect(page).toHaveURL(/tab=reviews/);
    },
    banner: "Critique supprimée",
  },
  {
    name: "comment",
    async setup(page, username) {
      const item = await newComment(page, username);
      return { url: VINCE_REVIEW, item };
    },
    async remove(page) {
      await clickAway(
        page
          .getByRole("listitem")
          .filter({ hasText: "Un commentaire à effacer" })
          .getByRole("button", {
            name: "Supprimer",
          }),
      );
    },
    banner: "Commentaire supprimé",
  },
  {
    name: "listen",
    async setup(page) {
      await page.goto(ALBUM);
      const answered = actionAnswered(page);
      await expect(async () => {
        await panelOf(page).getByRole("button", { name: "J'ai écouté" }).click();
        await expect(listenRow(page)).toBeVisible({ timeout: 2_000 });
      }).toPass();
      await answered;
      return { url: ALBUM, item: listenRow(page) };
    },
    async remove(page) {
      await listenRow(page).click();
      const dialog = page.getByRole("dialog");
      await clickAway(dialog.getByRole("button", { name: "Supprimer" }));
      await expect(dialog).toBeHidden();
    },
    banner: "Écoute supprimée",
  },
];

for (const c of cases) {
  test.describe(`deleting a ${c.name}`, () => {
    test("Annuler brings it back, for good", async ({ page }, testInfo) => {
      await page.clock.install();
      const username = await signUp(page, testInfo, "Effaceuse");
      const { url, item } = await c.setup(page, username);
      await pauseClock(page);
      await c.remove(page);
      await expect(item).toBeHidden();
      const tracker = trackActions(page);
      await banners(page).getByText(c.banner).waitFor();
      await banners(page).getByRole("button", { name: "Annuler" }).click();
      await expect(item).toBeVisible();
      await page.clock.runFor(UNDO_MS);
      expect(tracker.sent()).toBe(0);
      await page.goto(url);
      await expect(item).toBeVisible();
    });

    test("without Annuler, it is deleted at the end of the delay", async ({ page }, testInfo) => {
      await page.clock.install();
      const username = await signUp(page, testInfo, "Effaceuse");
      const { url, item } = await c.setup(page, username);
      await pauseClock(page);
      await c.remove(page);
      await expect(banners(page).getByText(c.banner)).toBeVisible();
      await endDelay(page);
      await expect(banners(page).getByText(c.banner)).toBeHidden();
      await page.goto(url);
      await expect(item).toBeHidden();
    });

    test("the delay goes on through an internal navigation", async ({ page }, testInfo) => {
      await page.clock.install();
      const username = await signUp(page, testInfo, "Effaceuse");
      const { url, item } = await c.setup(page, username);
      await pauseClock(page);
      await c.remove(page);
      await goHome(page);
      await expect(banners(page).getByText(c.banner)).toBeVisible();
      await endDelay(page);
      await page.goto(url);
      await expect(item).toBeHidden();
    });
  });
}

test("the banner is announced, keyboard-friendly, and pauses on hover and focus", async ({
  page,
}, testInfo) => {
  await page.clock.install();
  const username = await signUp(page, testInfo, "Clavière");
  const first = await newComment(page, username);
  await pauseClock(page);
  const tracker = trackActions(page);
  const region = banners(page);

  // From the keyboard: the focus lands on "Annuler", and the delay waits while it is there.
  await first.getByRole("button", { name: "Supprimer" }).focus();
  await page.keyboard.press("Enter");
  await expect(region.getByRole("button", { name: "Annuler" })).toBeFocused();
  await expect(region.getByText("Commentaire supprimé")).toBeVisible();
  await page.clock.runFor(UNDO_MS * 2);
  expect(tracker.sent()).toBe(0);

  // Escape closes the banner without undoing: the deletion leaves now.
  const answered = actionAnswered(page);
  await page.keyboard.press("Escape");
  await answered;
  await expect(region.getByText("Commentaire supprimé")).toBeHidden();
  await expect(first).toBeHidden();

  // With the pointer over the banner, nothing leaves either; it goes once the pointer leaves.
  await page.clock.resume();
  const second = await newComment(page, `${username}-2`);
  await pauseClock(page);
  const sentBefore = tracker.sent();
  await second.getByRole("button", { name: "Supprimer" }).click();
  await region.getByText("Commentaire supprimé").hover();
  await page.clock.runFor(UNDO_MS * 2);
  expect(tracker.sent()).toBe(sentBefore);
  await page.mouse.move(0, 0);
  await endDelay(page);
  await page.reload();
  await expect(second).toBeHidden();
});

test("a failed deletion shows the item again with a message", async ({ page }, testInfo) => {
  await page.clock.install();
  const username = await signUp(page, testInfo, "Malchanceuse");
  const item = await newComment(page, username);
  await pauseClock(page);
  await clickAway(item.getByRole("button", { name: "Supprimer" }));
  await expect(item).toBeHidden();
  const restore = await failActions(page);
  await endDelay(page);
  await expect(item).toBeVisible();
  await expect(
    banners(page).getByText("Rien n'a été supprimé. Quelque chose s'est mal passé. Réessaie."),
  ).toBeVisible();
  await restore();
});

test("rating the record during the delay keeps the new rating", async ({ page }, testInfo) => {
  await page.clock.install();
  await signUp(page, testInfo, "Noteuse");
  await page.goto(ALBUM);
  const panel = panelOf(page);
  const slider = panel.getByRole("slider", { name: "Ta note" });
  const answered = actionAnswered(page);
  await expect(async () => {
    await slider.focus();
    await page.keyboard.press("End");
    await expect(panel.getByText("Note rapide, sans date")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await answered;

  await pauseClock(page);
  await remove(page);
  await expect(panel.getByText("Note rapide, sans date")).toBeHidden();

  // The new rating first sends the waiting deletion, then itself.
  const tracker = trackActions(page);
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await page.clock.runFor(1_000);
  await tracker.settled(2);
  await page.clock.runFor(UNDO_MS);
  await page.reload();
  await expect(panel.getByRole("slider", { name: "Ta note" })).toHaveAttribute(
    "aria-valuenow",
    "9",
  );
  await expect(panel.getByText("Note rapide, sans date")).toBeVisible();

  async function remove(p: Page) {
    await listenRow(p).click();
    const dialog = p.getByRole("dialog");
    await clickAway(dialog.getByRole("button", { name: "Supprimer" }));
    await expect(dialog).toBeHidden();
  }
});

test("a new review on the record during the delay is kept", async ({ page }, testInfo) => {
  await page.clock.install();
  const username = await signUp(page, testInfo, "Critique");
  const review = cases.find((c) => c.name === "review")!;
  await review.setup(page, username);
  await pauseClock(page);
  await review.remove(page);

  // Back to the album without reloading (the deletion still waits), and a new review.
  await page.getByRole("link", { name: "Journal", exact: true }).click();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Nocturnes pour pluie fine" })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${ALBUM}$`));
  const body = `Seconde critique, gardée (${username}).`;
  const dialog = page.getByRole("dialog");
  await page
    .getByRole("region", { name: "Ton écoute" })
    .getByRole("button", { name: "Journaliser…" })
    .click();
  await dialog.getByLabel("Critique (facultative)").fill(body);
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();
  await page.clock.runFor(UNDO_MS);

  await page.goto(`/fr/u/${username}?tab=reviews`);
  await expect(page.getByRole("main").getByText(body)).toBeVisible();
  await expect(page.getByRole("main").getByText("Une pluie fine sur le zinc")).toBeHidden();
});
