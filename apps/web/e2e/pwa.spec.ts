import { expect, test } from "./fixtures";

test.use({ locale: "fr-FR" });

test("the manifest is served, installable and its icons exist", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Spleen", display: "standalone", start_url: "/" });
  expect(manifest.theme_color).toMatch(/^#[0-9A-F]{6}$/i);
  const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
  expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(
    expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]),
  );
  for (const icon of icons) {
    const image = await request.get(icon.src);
    expect(image.headers()["content-type"]).toBe("image/png");
  }
});

test("the service worker is served uncached and never touches /api", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.headers()["cache-control"]).toBe("no-cache");
  const script = await response.text();
  expect(script).toContain('url.pathname.startsWith("/api/")');
});

test("the service worker registers, and shows the offline page without a network", async ({
  page,
  context,
}) => {
  await page.goto("/fr/discover");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
  // The page that registered it is not controlled yet: the next load is.
  await expect(async () => {
    await page.reload();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  }).toPass();
  await context.setOffline(true);
  try {
    await page.goto("/fr/u/nuitblanche");
    await expect(page.getByRole("heading", { name: "La platine tourne à vide" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Réessayer" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
