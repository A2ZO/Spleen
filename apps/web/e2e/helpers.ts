import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createDb, eq, isPostgresUrl, loadRootEnv, schema, setAdminRole } from "@spleen/db";
import { expect, type Page, type TestInfo } from "./fixtures";

// Without BREVO_API_KEY, the dev server writes emails to <repo>/.data/outbox (see @spleen/infra).
const outbox = path.resolve(import.meta.dirname, "../../../.data/outbox");

/** Waits for the latest sign-in email sent to `email` and returns what `pick` finds in it. */
async function fromSignInEmail(
  email: string,
  pick: (text: string) => string | undefined,
): Promise<string> {
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
      const found = pick(mail.text);
      if (found) return found;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`no sign-in email for ${email} in ${outbox}`);
}

/** Waits for the magic link sent to `email` and returns it. */
export const magicLinkFor = (email: string) =>
  fromSignInEmail(email, (text) => /https?:\/\/\S+/.exec(text)?.[0]);

/** Waits for the sign-in code sent with the link to `email`, as written ("123 456"). */
export const signInCodeFor = (email: string) =>
  fromSignInEmail(email, (text) => /\b\d{3} \d{3}\b/.exec(text)?.[0]);

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
  await onboard(page, username, displayName);
  return username;
}

/** Waits until React has hydrated the page (`HydrationMarker`): typing before that is lost. */
export async function waitForHydration(page: Page) {
  await expect(page.locator("html[data-hydrated]")).toBeAttached();
}

const USERNAME_HINT = "3 à 30 caractères : lettres minuscules, chiffres, points et tirets bas.";

export const TERMS_BOX = "J'ai 15 ans ou plus et j'accepte les conditions d'utilisation";

/** Fills the first-visit form (any sign-in path ends there) and lands on the new profile. */
export async function onboard(page: Page, username: string, displayName: string) {
  await expect(page).toHaveURL(/\/fr\/welcome$/);
  // After a full load (the code path) the URL matches before hydration: the typed text now
  // survives it (issue #24), but the live check only starts once React has taken over.
  await waitForHydration(page);
  const field = page.getByLabel("Pseudo");
  await field.fill(username);
  // The hint gives way to the check's answer; anything but "free" fails with its own words.
  const message = page.locator(`[id="${await field.getAttribute("id")}-msg"]`);
  await expect(message).not.toHaveText(USERNAME_HINT);
  expect(await message.innerText(), "username check").toBe("Ce pseudo est libre.");
  await page.getByLabel("Nom affiché").fill(displayName);
  await page.getByLabel(TERMS_BOX).check();
  await page.getByRole("button", { name: "Ouvrir mon étagère" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/u/${username}$`));
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

/**
 * State of the global MusicBrainz gate (`rate_limits` row "musicbrainz"): every provider call
 * moves it. Undefined on a PGlite database (it belongs to the dev server process).
 */
export async function musicBrainzGate(): Promise<string | null | undefined> {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!isPostgresUrl(url)) return undefined;
  const handle = createDb(url);
  try {
    const [row] = await handle.db
      .select({ at: schema.rateLimits.nextAllowedAt })
      .from(schema.rateLimits)
      .where(eq(schema.rateLimits.key, "musicbrainz"));
    return row?.at?.toISOString() ?? null;
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

/** Server Action calls of the page (POST with a `next-action` header). */
const isAction = (request: { method(): string; headers(): Record<string, string> }) =>
  request.method() === "POST" && "next-action" in request.headers();

/**
 * The answer to the next Server Action call. Reactions leave after a short delay
 * (`GROUP_MS`): wait for it before a `page.goto` or `reload`, which would drop them.
 */
export const actionAnswered = (page: Page) =>
  page.waitForResponse((response) => isAction(response.request()));

/** Counts the Server Action calls of the page from now on, sent and answered. */
export function trackActions(page: Page) {
  const counts = { sent: 0, answered: 0 };
  page.on("request", (request) => {
    if (isAction(request)) counts.sent += 1;
  });
  page.on("requestfinished", (request) => {
    if (isAction(request)) counts.answered += 1;
  });
  page.on("requestfailed", (request) => {
    if (isAction(request)) counts.answered += 1;
  });
  return {
    sent: () => counts.sent,
    /** Waits until `n` calls were sent and every one of them answered. */
    settled: async (n: number) => {
      await expect.poll(() => counts.sent).toBe(n);
      await expect.poll(() => counts.answered).toBe(n);
    },
  };
}

/** Holds every Server Action call until `release()`: what the page shows before the answer. */
export async function holdActions(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/*", async (route) => {
    if (!isAction(route.request())) return route.fallback();
    await gate;
    await route.continue();
  });
  return async () => {
    release();
    await page.unrouteAll({ behavior: "wait" });
  };
}

/** Answers every Server Action call with a 500 (server down) until the returned undo. */
export async function failActions(page: Page) {
  await page.route("**/*", (route) =>
    isAction(route.request()) ? route.fulfill({ status: 500, body: "" }) : route.fallback(),
  );
  return () => page.unrouteAll({ behavior: "wait" });
}

/** Runs `change` on the dev server's Postgres database; false on PGlite (its own process). */
async function onDevDatabase(
  change: (db: ReturnType<typeof createDb>["db"]) => Promise<void>,
): Promise<boolean> {
  loadRootEnv();
  const url = process.env.DATABASE_URL;
  if (!isPostgresUrl(url)) return false;
  const handle = createDb(url);
  try {
    await change(handle.db);
    return true;
  } finally {
    await handle.close();
  }
}

async function userIdOf(db: ReturnType<typeof createDb>["db"], username: string) {
  const [row] = await db
    .select({ id: schema.profiles.userId })
    .from(schema.profiles)
    .where(eq(schema.profiles.username, username));
  return row!.id;
}

/** Spends the member's whole hourly budget of a write bucket (`spend()` in `root.ts`). */
export const exhaustRateLimit = (username: string, bucket: string) =>
  onDevDatabase(async (db) => {
    const key = `${bucket}:${await userIdOf(db, username)}`;
    await db
      .insert(schema.rateLimits)
      .values({ key, count: 100_000 })
      .onConflictDoUpdate({
        target: schema.rateLimits.key,
        set: { count: 100_000, windowStart: new Date() },
      });
  });

/** Suspends the member outside the site, keeping their session (as if it happened meanwhile). */
export const suspendInDatabase = (username: string) =>
  onDevDatabase(async (db) => {
    await db
      .update(schema.profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(schema.profiles.username, username));
  });
