import { expect, test, type Page } from "./fixtures";

import { actionAnswered, signUp, trackActions, waitForHydration } from "./helpers";

/*
 * Single-key shortcuts (`lib/keyboard-shortcuts.ts`): 1..5 / 0 / L on a record's page, "?" for
 * the help, "/" for the search, all turned off from /settings. Accounts are left to the global
 * teardown; the demo album is shared, but ratings and hearts are per member.
 */

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const ALBUM = "/fr/album/nocturnes-pour-pluie-fine";

async function openAlbum(page: Page) {
  await page.goto(ALBUM);
  await waitForHydration(page);
  const panel = page.getByRole("region", { name: "Ton écoute" });
  return {
    panel,
    slider: panel.getByRole("slider", { name: "Ta note" }),
    heart: panel.getByRole("button", { name: "Coup de cœur" }),
    status: panel.locator("[aria-live]"),
  };
}

test("1..5 rate the record, 0 clears it, and the result is announced", async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo, "Clavière");
  const { slider, status } = await openAlbum(page);

  const saved = actionAnswered(page);
  await page.keyboard.press("Digit4");
  await expect(slider).toHaveAttribute("aria-valuenow", "8");
  await expect(status).toHaveText("Noté 4 sur 5");
  await saved;
  await page.reload();
  await waitForHydration(page);
  await expect(slider).toHaveAttribute("aria-valuenow", "8");

  const cleared = actionAnswered(page);
  await page.keyboard.press("Digit0");
  await expect(slider).not.toHaveAttribute("aria-valuenow");
  await expect(status).toHaveText("Note retirée");
  await cleared;
  await page.reload();
  await waitForHydration(page);
  await expect(slider).not.toHaveAttribute("aria-valuenow");
});

test("the key position counts, not the character (AZERTY)", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Azerty");
  const { slider } = await openAlbum(page);
  // AZERTY's top row without Shift: the key "4" types an apostrophe.
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Digit4", key: "'", bubbles: true }),
    ),
  );
  await expect(slider).toHaveAttribute("aria-valuenow", "8");
  await actionAnswered(page);
});

test("L toggles the heart, once while held", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Cœurclavier");
  const { heart, status } = await openAlbum(page);
  const actions = trackActions(page);

  await page.keyboard.press("l");
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect(status).toHaveText("Coup de cœur ajouté");
  await actions.settled(1);

  await page.keyboard.press("L");
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await expect(status).toHaveText("Coup de cœur retiré");
  await actions.settled(2);

  // Held down: the next keydowns are repeats (`event.repeat`), ignored. Four of them: each
  // toggling would end with no heart.
  for (let i = 0; i < 4; i += 1) await page.keyboard.down("l");
  await page.keyboard.up("l");
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await actions.settled(3);
  await page.waitForTimeout(800);
  expect(actions.sent()).toBe(3);
  await expect(heart).toHaveAttribute("aria-pressed", "true");
});

test("no rating while typing in a field or with Ctrl", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Sanssuite");
  const { slider } = await openAlbum(page);
  const actions = trackActions(page);
  // The header's search field; on small screens it lives in the full-screen search window
  // opened by the tab bar's "+" (members; detail pages hide the header row on phones).
  const mobile = testInfo.project.name === "mobile";
  if (mobile) {
    await page.getByRole("link", { name: "Noter un disque" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  const field = page.locator(mobile ? "#dialog-search" : "#header-search");
  await field.focus();
  await page.keyboard.type("4");
  await expect(field).toHaveValue("4");
  if (mobile) {
    await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } else {
    await page.keyboard.press("Escape");
    await field.blur();
  }

  await page.keyboard.press("Control+Digit1");
  await page.waitForTimeout(800);
  await expect(slider).not.toHaveAttribute("aria-valuenow");
  expect(actions.sent()).toBe(0);
});

test("? opens the help, Escape closes it; a visitor is told to sign in", async ({ page }) => {
  await page.goto(ALBUM);
  await waitForHydration(page);
  const help = page.getByRole("dialog", { name: "Raccourcis clavier" });

  await page.keyboard.press("?");
  await expect(help).toBeVisible();
  await expect(help.getByText("Connecte-toi pour noter")).toBeVisible();
  await expect(help.getByRole("checkbox", { name: "Raccourcis d'une touche" })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();

  // The footer button opens it too (it still works with shortcuts off).
  await page.getByRole("button", { name: "Raccourcis clavier" }).click();
  await expect(help).toBeVisible();
});

test("shortcuts turned off in the settings: no rating, no search", async ({ page }, testInfo) => {
  await signUp(page, testInfo, "Silencieuse");
  await page.goto("/fr/settings");
  await waitForHydration(page);
  const toggle = page.getByRole("checkbox", { name: "Raccourcis d'une touche" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();

  const { slider } = await openAlbum(page);
  const actions = trackActions(page);
  await page.keyboard.press("Digit4");
  await page.keyboard.press("/");
  await page.keyboard.press("?");
  await page.waitForTimeout(800);
  await expect(slider).not.toHaveAttribute("aria-valuenow");
  expect(actions.sent()).toBe(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#header-search")).not.toBeFocused();
});
