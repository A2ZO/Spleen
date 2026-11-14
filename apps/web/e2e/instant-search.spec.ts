import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

import { musicBrainzGate, waitForHydration } from "./helpers";

// Instant search (docs/catalogue.md, "Recherche"), on the demo seed only.
test.use({ locale: "fr-FR" });

/** The header field (desktop) after hydration. */
async function headerSearch(page: Page) {
  await page.goto("/fr");
  await waitForHydration(page);
  return page.getByRole("combobox", { name: "Rechercher", exact: true });
}

const suggestions = (page: Page) => page.getByRole("listbox", { name: "Suggestions" });

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the phone gets the full-screen search");

  test("typing shows suggestions from the local catalog only", async ({ page }) => {
    const gate = await musicBrainzGate();
    const field = await headerSearch(page);
    // Only the suggestion route while typing: no page render, no server action. Link prefetches
    // (production only: the header links in view) are not renders.
    const sent: string[] = [];
    page.on("request", (request) => {
      const headers = request.headers();
      if (headers["next-router-prefetch"]) return;
      if (headers["next-action"] || headers.rsc || request.url().includes("_rsc="))
        sent.push(`render ${request.url()}`);
      else if (request.url().includes("/api/")) sent.push(new URL(request.url()).pathname);
    });

    await field.pressSequentially("lune bas", { delay: 40 });
    const best = suggestions(page).getByRole("group", { name: "Meilleur résultat" });
    await expect(best.getByRole("option", { name: /^Lune Basse/ })).toBeVisible();
    await expect(best.locator("strong").first()).toHaveText("Lune");
    await expect(page.getByRole("status")).toHaveText(/\d+ suggestions?/);
    await expect(field).toHaveAttribute("aria-expanded", "true");
    expect(new Set(sent)).toEqual(new Set(["/api/search/suggest"]));
    // The provider gate did not move: no MusicBrainz call.
    expect(await musicBrainzGate()).toEqual(gate);
  });

  test("arrows and Enter open a page, Escape closes", async ({ page }) => {
    const field = await headerSearch(page);
    await field.fill("nocturnes");
    await expect(suggestions(page).getByRole("group", { name: "Meilleur résultat" })).toBeVisible();
    await field.press("Escape");
    await expect(field).toHaveAttribute("aria-expanded", "false");
    await field.press("ArrowDown");
    const active = page.locator(`[id="${await field.getAttribute("aria-activedescendant")}"]`);
    await expect(active).toHaveAttribute("aria-selected", "true");
    const href = await active.getAttribute("href");
    await field.press("Enter");
    expect(href).toMatch(/^\/fr\/(album|artist|track)\//);
    await expect(page).toHaveURL((url) => url.pathname === href);
  });

  test("Enter without a choice opens every result; recent searches come back", async ({ page }) => {
    const field = await headerSearch(page);
    await field.fill("Béton");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/fr\/search\?q=B%C3%A9ton$/);
    await expect(
      page.getByRole("region", { name: "Albums, EP et singles" }).getByRole("link", {
        name: "Béton velours",
      }),
    ).toBeVisible();

    await page.goto("/fr");
    await waitForHydration(page);
    await page.keyboard.press("/");
    const recent = suggestions(page).getByRole("group", { name: "Recherches récentes" });
    await expect(recent.getByRole("option", { name: "Béton" })).toBeVisible();
    const header = page.getByRole("combobox", { name: "Rechercher", exact: true });
    await expect(header).toBeFocused();
    await header.press("ArrowDown");
    await header.press("Delete");
    await expect(recent).not.toBeAttached();
  });

  test("nothing found invites visitors to sign in, and the popup passes axe", async ({ page }) => {
    const field = await headerSearch(page);
    await field.fill("xqzwvk");
    await expect(page.getByRole("status")).toHaveText("Rien dans Spleen pour l'instant");
    await expect(
      suggestions(page).getByRole("option", { name: "Connecte-toi pour l'ajouter à Spleen" }),
    ).toHaveAttribute("href", "/fr/sign-in");

    await field.fill("pluie");
    await expect(suggestions(page).getByRole("option").nth(1)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id),
    ).toEqual([]);
  });

  test("the query is normalised before the call, for one cached URL", async ({ page }) => {
    const field = await headerSearch(page);
    const call = page.waitForRequest(/\/api\/search\/suggest\?/);
    await field.fill("  LUNE   Bas ");
    expect(new URL((await call).url()).searchParams.get("q")).toBe("lune bas");
  });

  test("a 429 keeps the last suggestions, silently; the next keystroke tries again", async ({
    page,
  }) => {
    const field = await headerSearch(page);
    await field.fill("lune");
    const best = suggestions(page)
      .getByRole("group", { name: "Meilleur résultat" })
      .getByRole("option", { name: /^Lune Basse/ });
    await expect(best).toBeVisible();

    const route = /\/api\/search\/suggest\?/;
    await page.route(route, (r) =>
      r.fulfill({
        status: 429,
        headers: { "retry-after": "1", "cache-control": "no-store" },
        json: { error: 429 },
      }),
    );
    const refused = page.waitForResponse((r) => route.test(r.url()) && r.status() === 429);
    await field.pressSequentially(" b");
    await refused;
    await expect(best).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("");

    await page.unroute(route);
    const answered = page.waitForResponse((r) => route.test(r.url()) && r.status() === 200);
    await field.press("a");
    await answered;
    await expect(page.getByRole("status")).toHaveText(/\d+ suggestions?/);
    await expect(best).toBeVisible();
  });

  test("the answer is public and the same with a session cookie", async ({ request }) => {
    const plain = await request.get("/api/search/suggest?q=pluie");
    expect(plain.status()).toBe(200);
    expect(plain.headers()["cache-control"]).toContain("public");
    expect(plain.headers()["cache-control"]).toContain("s-maxage=");
    expect(plain.headers()["set-cookie"]).toBeUndefined();
    const withCookie = await request.get("/api/search/suggest?q=pluie", {
      headers: { cookie: "better-auth.session_token=whatever" },
    });
    expect(await withCookie.text()).toBe(await plain.text());
    expect(withCookie.headers()["set-cookie"]).toBeUndefined();

    // No translated text: the language is not part of the cached URL.
    const english = await request.get("/api/search/suggest?q=pluie", {
      headers: { "accept-language": "en-US", cookie: "NEXT_LOCALE=en" },
    });
    expect(await english.text()).toBe(await plain.text());

    const short = await request.get("/api/search/suggest?q=p");
    expect(short.status()).toBe(400);
    expect(short.headers()["cache-control"]).toBe("no-store");
  });
});

test("phones get a full-screen search", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/fr");
  await waitForHydration(page);
  await page.getByRole("link", { name: "Rechercher" }).click();
  const dialog = page.getByRole("dialog", { name: "Rechercher" });
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(page.viewportSize()?.width);
  const field = dialog.getByRole("combobox", { name: "Rechercher" });
  await expect(field).toBeFocused();
  await field.pressSequentially("vitre", { delay: 40 });
  await dialog
    .getByRole("option", { name: /^Vitre embuée/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/fr\/track\/vitre-embuee/);
  await expect(dialog).not.toBeAttached();
});
