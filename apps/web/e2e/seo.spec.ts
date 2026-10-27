import { expect, test } from "@playwright/test";

test.use({ locale: "fr-FR" });

const ALBUM = "/fr/album/nocturnes-pour-pluie-fine";

test("robots.txt lets search engines in and keeps AI training crawlers out", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/User-Agent: \*\nAllow: \//);
  for (const bot of ["GPTBot", "Google-Extended", "ClaudeBot", "CCBot"]) {
    expect(robots).toContain(`User-Agent: ${bot}`);
  }
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("the sitemap lists indexable pages in both languages", async ({ request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).toContain("/sitemaps/releases-1.xml");
  const releases = await request.get("/sitemaps/releases-1.xml");
  expect(releases.headers()["content-type"]).toContain("application/xml");
  const xml = await releases.text();
  expect(xml).toContain(`${ALBUM}</loc>`);
  expect(xml).toContain('hreflang="en" href="');
  expect((await request.get("/sitemaps/nothing-1.xml")).status()).toBe(404);
});

test("a record page has its canonical, language links and a versioned share image", async ({
  page,
  request,
}) => {
  await page.goto(ALBUM);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`${ALBUM}$`),
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    /\/en\/album\/nocturnes-pour-pluie-fine$/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toMatch(/\/og\/release\/nocturnes-pour-pluie-fine\?v=/);
  const response = await request.get(new URL(image!).pathname + new URL(image!).search);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect((await request.get("/og/review/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
});

test("search results are not indexed", async ({ page }) => {
  await page.goto("/fr/search?q=pluie");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
