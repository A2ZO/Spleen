import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect, type Page, type TestInfo } from "@playwright/test";

// Without BREVO_API_KEY, the dev server writes emails to <repo>/.data/outbox (see @spleen/infra).
const outbox = path.resolve(import.meta.dirname, "../../../.data/outbox");

/** Waits for the magic link sent to `email` and returns it. */
export async function magicLinkFor(email: string): Promise<string> {
  const safe = email.replace(/[^a-z0-9@._-]/gi, "_");
  for (let attempt = 0; attempt < 50; attempt++) {
    const files = (await readdir(outbox).catch(() => [])).filter((f) =>
      f.endsWith(`-${safe}.json`),
    );
    const latest = files.sort().at(-1);
    if (latest) {
      const mail = JSON.parse(await readFile(path.join(outbox, latest), "utf8")) as {
        text: string;
      };
      const link = /https?:\/\/\S+/.exec(mail.text)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`no magic link for ${email} in ${outbox}`);
}

/** Signs up a new member (French UI) and returns their @username, on their profile page. */
export async function signUp(page: Page, testInfo: TestInfo, displayName: string) {
  const id = `${Date.now().toString(36)}${testInfo.project.name.slice(0, 1)}`;
  const email = `e2e-${id}@example.test`;
  const username = `e2e_${id}`;

  await page.goto("/fr/sign-in");
  await page.getByLabel("Ton email").fill(email);
  await page.getByRole("button", { name: "Recevoir mon lien" }).click();
  await expect(page.getByRole("heading", { name: "Regarde ta boîte mail" })).toBeVisible();

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(/\/fr\/welcome$/);
  await page.getByLabel("Pseudo").fill(username);
  await expect(page.getByText("Ce pseudo est libre.")).toBeVisible();
  await page.getByLabel("Nom affiché").fill(displayName);
  await page.getByLabel("J'ai 15 ans ou plus").check();
  await page.getByRole("button", { name: "Ouvrir mon étagère" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/u/${username}$`));
  return username;
}

/** Deletes the signed-in member's account from the settings page. */
export async function deleteAccount(page: Page, username: string) {
  await page.goto("/fr/settings");
  await page.getByLabel(`Tape ton pseudo (${username}) pour confirmer`).fill(username);
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(/\/fr$/);
}
