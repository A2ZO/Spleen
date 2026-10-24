import { expect, test } from "@playwright/test";

import { deleteAccount, signUp } from "./helpers";

test.use({ locale: "fr-FR", timezoneId: "Europe/Paris" });

const VINCE_REVIEW = "/fr/review/00000000-0000-4000-8000-000000000507";

test("a newcomer follows, likes and comments; another member follows and gets blocked", async ({
  browser,
}, testInfo) => {
  const alice = await browser.newPage();
  const bob = await browser.newPage();
  const aliceName = await signUp(alice, testInfo, "Alice Nocturne");
  const bobName = await signUp(bob, testInfo, "Bob Sillon");

  // An empty friends feed welcomes the newcomer with members to discover.
  await alice.goto("/fr");
  await expect(alice.getByText("Ton fil est encore silencieux.")).toBeVisible();
  await expect(alice.getByRole("heading", { name: "Des oreilles à découvrir" })).toBeVisible();

  // Following a demo member fills the feed.
  await alice.goto("/fr/u/vinylvince");
  await expect(async () => {
    await alice.getByRole("button", { name: "Suivre Vince" }).click();
    await expect(alice.getByRole("button", { name: "Ne plus suivre Vince" })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass();
  await alice.goto("/fr");
  await expect(alice.getByText("Vince").first()).toBeVisible();
  await expect(alice.getByText("Ton fil est encore silencieux.")).toBeHidden();

  // Like and comment a review.
  await alice.goto(VINCE_REVIEW);
  const like = alice.getByRole("button", { name: /J'aime/ });
  await expect(async () => {
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
  }).toPass();
  await alice.getByLabel("Ton commentaire").fill("Ce disque réchauffe la rue, c'est vrai.");
  await alice.getByRole("button", { name: "Publier" }).click();
  await expect(alice.getByText("Ce disque réchauffe la rue, c'est vrai.")).toBeVisible();

  // Bob follows Alice: she gets a notification and a badge.
  await bob.goto(`/fr/u/${aliceName}`);
  await expect(async () => {
    await bob.getByRole("button", { name: "Suivre Alice Nocturne" }).click();
    await expect(bob.getByRole("button", { name: "Ne plus suivre Alice Nocturne" })).toBeVisible({
      timeout: 2_000,
    });
  }).toPass();
  await alice.goto("/fr/notifications");
  await expect(alice.getByText("Bob Sillon te suit désormais")).toBeVisible();
  await expect(alice.getByRole("link", { name: /Notifications \(1 non lue\)/ })).toBeVisible();
  await alice.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await expect(alice.getByText("Tout est lu")).toBeVisible();

  // Alice blocks Bob: he no longer follows her and can't follow her again (without being told).
  await alice.goto(`/fr/u/${bobName}`);
  await expect(async () => {
    await alice.getByRole("button", { name: "Plus d'actions pour Bob Sillon" }).click();
    await expect(alice.getByRole("button", { name: "Bloquer" })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await alice.getByRole("button", { name: "Bloquer" }).click();
  await alice.getByRole("dialog").getByRole("button", { name: "Bloquer" }).click();
  await expect(alice.getByRole("dialog")).toBeHidden();
  await alice.goto("/fr/settings/blocks");
  await expect(alice.getByText(`@${bobName}`)).toBeVisible();

  await bob.goto(`/fr/u/${aliceName}`);
  await expect(bob.getByText("0 abonné")).toBeVisible();
  await expect(bob.getByRole("button", { name: /Suivre/ })).toHaveCount(0);
  await expect(bob.getByText(/bloqu/i)).toHaveCount(0);

  await deleteAccount(alice, aliceName);
  await deleteAccount(bob, bobName);
});
