import { expect, test } from "@playwright/test";

import { deleteAccount, emailOf, grantAdmin, signIn, signUp } from "./helpers";

test.use({ locale: "fr-FR" });

test("the moderation area does not exist for visitors and members", async ({ page }, testInfo) => {
  const response = await page.goto("/fr/admin");
  expect(response?.status()).toBe(404);
  const username = await signUp(page, testInfo, "Curieuse");
  expect((await page.goto("/fr/admin/suspended"))?.status()).toBe(404);
  await deleteAccount(page, username);
});

test("a suspended member learns why only once signed in, until the suspension is lifted", async ({
  browser,
}, testInfo) => {
  const member = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  const admin = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  const username = await signUp(member, testInfo, "Suspendue");
  const moderator = await signUp(admin, testInfo, "Modératrice");
  // Granted outside the site, as `pnpm admin:grant` does (one admin per test: parallel runs).
  test.skip(!(await grantAdmin(moderator)), "needs the Postgres database of the dev server");
  const reason = `Spam répété (${testInfo.project.name})`;

  await admin.goto("/fr/admin/suspended");
  const suspend = admin.getByRole("region", { name: "Suspendre un compte" });
  await suspend.getByLabel("Pseudo").fill(username);
  await suspend.getByLabel("Motif de la décision").fill(reason);
  await suspend.getByRole("button", { name: "Suspendre" }).click();
  await expect(suspend.getByText("C'est fait.")).toBeVisible();

  // The session ended. The sign-in page answers as for anyone: no reason before the link.
  await signIn(member, emailOf(username));
  await expect(member.getByRole("heading", { name: "Ton compte est suspendu" })).toBeVisible();
  await expect(member.getByText(reason)).toBeVisible();
  await member.goto(`/fr/u/${username}`);
  await expect(member.getByRole("heading", { name: "Ton compte est suspendu" })).toBeVisible();

  await admin.reload();
  const card = admin.getByRole("listitem").filter({ hasText: `@${username}` });
  await card.getByText("Lever la suspension").first().click();
  await card.getByLabel("Pourquoi lever la suspension ?").fill("Contestation acceptée");
  await card.getByRole("button", { name: "Lever la suspension" }).click();
  await expect(admin.getByText(`@${username}`)).toHaveCount(0);

  await deleteAccount(admin, moderator);
  await member.goto("/fr/notifications");
  await expect(member.getByText("La suspension de ton compte est levée.")).toBeVisible();
  await expect(member.getByText("Motif : Contestation acceptée")).toBeVisible();
  await deleteAccount(member, username);
});
