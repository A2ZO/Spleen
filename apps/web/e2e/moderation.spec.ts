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

test("content hidden by moderation stays visible to its author, with the reason", async ({
  browser,
}, testInfo) => {
  const author = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  const admin = await (await browser.newContext({ locale: "fr-FR" })).newPage();
  const username = await signUp(author, testInfo, "Bavarde");
  const moderator = await signUp(admin, testInfo, "Veilleur");
  test.skip(!(await grantAdmin(moderator)), "needs the Postgres database of the dev server");
  const body = `Achetez mes vinyles (${username})`;
  const reason = `Publicité (${testInfo.project.name})`;

  await author.goto("/fr/review/00000000-0000-4000-8000-000000000507");
  await author.getByLabel("Ton commentaire").fill(body);
  await author.getByRole("button", { name: "Publier" }).click();
  await expect(author.getByRole("paragraph").filter({ hasText: body })).toBeVisible();

  await admin.goto("/fr/review/00000000-0000-4000-8000-000000000507");
  const comment = admin.getByRole("article").filter({ hasText: body });
  await comment.getByRole("button", { name: "Signaler ce commentaire" }).click();
  await admin.getByRole("dialog").getByLabel("Spam ou publicité").check();
  await admin.getByRole("dialog").getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(admin.getByText("Merci. La modération va y jeter un œil.")).toBeVisible();
  await admin.goto("/fr/admin?kind=comment");
  const card = admin.getByRole("article").filter({ hasText: body });
  await card.getByLabel("Masquer le contenu").check();
  await card.getByLabel("Motif de la décision").fill(reason);
  await card.getByRole("button", { name: "Masquer" }).click();
  await expect(admin.getByRole("article").filter({ hasText: body })).toHaveCount(0);

  await admin.goto("/fr/review/00000000-0000-4000-8000-000000000507");
  await expect(admin.getByText(body)).toHaveCount(0);
  await author.reload();
  const hidden = author.getByRole("note");
  await expect(hidden.getByText("Masqué par la modération")).toBeVisible();
  await expect(hidden.getByText(`Motif : ${reason}`)).toBeVisible();

  await deleteAccount(admin, moderator);
  await deleteAccount(author, username);
});

test("a duplicate report needs the address of another page of the same kind", async ({
  page,
}, testInfo) => {
  const username = await signUp(page, testInfo, "Archiviste");
  await page.goto("/fr/album/nocturnes-pour-pluie-fine");
  await expect(async () => {
    await page.getByRole("button", { name: "Signaler une erreur ou proposer un ajout" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("C'est un doublon d'une autre fiche").check();
  await dialog.getByLabel("Adresse de l'autre fiche").fill("/fr/artist/pas-un-album");
  await dialog.getByRole("button", { name: "Envoyer" }).click();
  await expect(
    dialog.getByText("Cette adresse ne correspond à aucune fiche du même type."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await deleteAccount(page, username);
});
