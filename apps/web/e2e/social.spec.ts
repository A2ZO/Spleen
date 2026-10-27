import { expect, test, type Browser, type Page, type TestInfo } from "./fixtures";

import { signUp } from "./helpers";

// Accounts are deleted by the global teardown (`cleanup.ts`), even when a test fails.
test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const VINCE_REVIEW = "/fr/review/00000000-0000-4000-8000-000000000507";

/** Follows the member whose profile is open (retried: the button may not be hydrated yet). */
async function follow(page: Page, displayName: string) {
  await expect(async () => {
    await page.getByRole("button", { name: `Suivre ${displayName}` }).click();
    await expect(page.getByRole("button", { name: `Ne plus suivre ${displayName}` })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass();
}

/** Alice and Bob, two new members in their own browser contexts; Bob follows Alice. */
async function aliceFollowedByBob(browser: Browser, testInfo: TestInfo) {
  const [alice, bob] = [await browser.newPage(), await browser.newPage()];
  const [aliceName, bobName] = await Promise.all([
    signUp(alice, testInfo, "Alice Nocturne"),
    signUp(bob, testInfo, "Bob Sillon"),
  ]);
  await bob.goto(`/fr/u/${aliceName}`);
  await follow(bob, "Alice Nocturne");
  return { alice, bob, aliceName, bobName };
}

test("an empty friends feed suggests members, and following one fills it", async ({
  page,
}, testInfo) => {
  await signUp(page, testInfo, "Alice Nocturne");
  await page.goto("/fr");
  await expect(page.getByText("Ton fil est encore silencieux.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Des oreilles à découvrir" })).toBeVisible();

  await page.goto("/fr/u/vinylvince");
  await follow(page, "Vince");
  await page.goto("/fr");
  await expect(page.getByText("Vince").first()).toBeVisible();
  await expect(page.getByText("Ton fil est encore silencieux.")).toBeHidden();
});

test("a member likes and comments a review", async ({ page }, testInfo) => {
  const username = await signUp(page, testInfo, "Alice Nocturne");
  await page.goto(VINCE_REVIEW);
  const like = page.getByRole("button", { name: /J'aime/ });
  await expect(async () => {
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
  }).toPass();

  // Unique text: desktop and mobile runs comment the same review at the same time.
  const comment = `Ce disque réchauffe la rue, c'est vrai (${username}).`;
  await page.getByLabel("Ton commentaire").fill(comment);
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: comment })).toBeVisible();
});

test("a new follower is notified, with a badge, and everything can be marked read", async ({
  browser,
}, testInfo) => {
  const { alice } = await aliceFollowedByBob(browser, testInfo);
  await alice.goto("/fr/notifications");
  await expect(alice.getByText("Bob Sillon te suit désormais")).toBeVisible();
  await expect(alice.getByRole("link", { name: /Notifications \(1 non lue\)/ })).toBeVisible();
  await alice.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await expect(alice.getByText("Tout est lu")).toBeVisible();
});

test("blocking ends the follow and hides the interactions, without telling", async ({
  browser,
}, testInfo) => {
  const { alice, bob, aliceName, bobName } = await aliceFollowedByBob(browser, testInfo);
  await alice.goto(`/fr/u/${bobName}`);
  await expect(async () => {
    await alice.getByRole("button", { name: "Plus d'actions pour Bob Sillon" }).click();
    await expect(alice.getByRole("button", { name: "Bloquer" })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await alice.getByRole("button", { name: "Bloquer" }).click();
  await alice.getByRole("dialog").getByRole("button", { name: "Bloquer" }).click();
  await expect(alice.getByRole("dialog")).toBeHidden();
  // The profile refreshes (Bob no longer follows anyone): leaving earlier aborts that render.
  await expect(alice.getByText("0 abonnement", { exact: true })).toBeVisible();
  await alice.goto("/fr/settings/blocks");
  await expect(alice.getByText(`@${bobName}`)).toBeVisible();

  await bob.goto(`/fr/u/${aliceName}`);
  await expect(bob.getByText("0 abonné")).toBeVisible();
  await expect(bob.getByRole("button", { name: /Suivre/ })).toHaveCount(0);
  await expect(bob.getByText(/bloqu/i)).toHaveCount(0);
});

test("a stale or edited cursor in the URL falls back to the first page", async ({ page }) => {
  for (const path of ["/fr", VINCE_REVIEW, "/fr/u/vinylvince/followers"]) {
    const response = await page.goto(`${path}?after=bm9wZQ`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("link", { name: /^Revenir au/ })).toHaveCount(0);
  }
});
