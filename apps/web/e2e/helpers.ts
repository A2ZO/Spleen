import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createDb, isPostgresUrl, loadRootEnv, schema, setAdminRole } from "@spleen/db";
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
  // Random part: parallel tests of one project may sign up in the same millisecond.
  const random = Math.random().toString(36).slice(2, 5);
  const id = `${Date.now().toString(36)}${random}${testInfo.project.name.slice(0, 1)}`;
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

/** Email of an account made by `signUp`, from its @username. */
export const emailOf = (username: string) => `${username.replace("e2e_", "e2e-")}@example.test`;

/** Signs in an existing account (demo or e2e) with a magic link; lands on the home page. */
export async function signIn(page: Page, email: string) {
  await page.goto("/fr/sign-in");
  await page.getByLabel("Ton email").fill(email);
  await page.getByRole("button", { name: "Recevoir mon lien" }).click();
  await expect(page.getByRole("heading", { name: "Regarde ta boîte mail" })).toBeVisible();
  await page.goto(await magicLinkFor(email));
}

/**
 * Gives an e2e account the admin role, with the function behind `pnpm admin:grant` (the site
 * itself never grants it). Postgres only: a PGlite database belongs to the dev server.
 */
export async function grantAdmin(username: string): Promise<boolean> {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!isPostgresUrl(url)) return false;
  const handle = createDb(url);
  try {
    return (await setAdminRole(handle.db, emailOf(username), true)) === "granted";
  } finally {
    await handle.close();
  }
}

/** Deletes the signed-in member's account from the settings page. */
export async function deleteAccount(page: Page, username: string) {
  await page.goto("/fr/settings");
  await page.getByLabel(`Tape ton pseudo (${username}) pour confirmer`).fill(username);
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(/\/fr$/);
}

/**
 * Throwaway albums for one test: slug `e2e-<id>-<n>`, no MusicBrainz id, so the global
 * teardown deletes them (reports first, merged ones before the others) and nothing else.
 * Null on a PGlite database (it belongs to the dev server process).
 */
export async function throwawayReleases(
  testInfo: TestInfo,
  count: number,
): Promise<{ slug: string; title: string }[] | null> {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!isPostgresUrl(url)) return null;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${testInfo.project.name.slice(0, 1)}`;
  const handle = createDb(url);
  try {
    return await handle.db
      .insert(schema.releases)
      .values(
        Array.from({ length: count }, (_, i) => ({
          slug: `e2e-${id}-${i + 1}`,
          title: `Disque jetable ${id} ${i + 1}`,
          type: "album" as const,
          tracklistImportedAt: new Date(),
        })),
      )
      .returning({ slug: schema.releases.slug, title: schema.releases.title });
  } finally {
    await handle.close();
  }
}
