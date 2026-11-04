import { expect, test } from "./fixtures";
import { waitForHydration } from "./helpers";

test.use({ locale: "fr-FR" });

const ALBUM = "/fr/album/i-never-loved-a-man-the-way-i-love-you";
const TITLE = "I Never Loved a Man (the Way I Love You)";
// 1x1 PNG: enough for the browser to decode a real image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// The real service is not called (it answers 500 from time to time). Playwright does not route
// the target of a redirect, so only the first hop is stubbed; the archive.org hosts that
// the redirect leads to are covered by the policy assertions in `security.spec.ts`.
test("the cover loads from Cover Art Archive, under the policy", async ({ page }) => {
  await page.route("https://coverartarchive.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: PNG }),
  );
  await page.goto(ALBUM);
  const cover = page.locator("main img").first();
  await expect(cover).toHaveAttribute("src", /^https:\/\/coverartarchive\.org\//);
  await cover.scrollIntoViewIfNeeded();
  await expect
    .poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
});

test("a cover that fails during the page load gives way to the generated sleeve", async ({
  page,
}) => {
  await page.route("https://coverartarchive.org/**", (route) => route.fulfill({ status: 500 }));
  await page.goto(ALBUM);
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.getByRole("img", { name: TITLE }).getByText(TITLE)).toBeVisible();
});

test("a cover that fails after hydration gives way to the generated sleeve", async ({ page }) => {
  // The answer is held until React has taken over: the failure reaches the mounted listener.
  let release = () => {};
  const hydrated = new Promise<void>((resolve) => (release = resolve));
  await page.route("https://coverartarchive.org/**", async (route) => {
    await hydrated;
    await route.fulfill({ status: 500 });
  });
  await page.goto(ALBUM, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await expect(page.locator("main img")).toHaveCount(1);
  release();
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.getByRole("img", { name: TITLE }).getByText(TITLE)).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a cover that fails leaves the plain background, no broken image", async ({ page }) => {
    await page.route("https://coverartarchive.org/**", (route) => route.fulfill({ status: 500 }));
    await page.goto(ALBUM);
    const cover = page.locator("main img").first();
    await expect(cover).toHaveAttribute("alt", "");
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete)).toBe(true);
    expect(await cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(0);
    // The sleeve keeps its name; no generated artwork is drawn without JavaScript.
    const sleeve = page.getByRole("img", { name: TITLE });
    await expect(sleeve).toBeVisible();
    await expect(sleeve.getByText(TITLE)).toHaveCount(0);
  });
});

test("a cover that failed before hydration is removed once React takes over", async ({ page }) => {
  await page.route("https://coverartarchive.org/**", (route) => route.fulfill({ status: 500 }));
  // The scripts arrive late: the image has long failed when React attaches.
  await page.route("**/_next/static/**/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto(ALBUM, { waitUntil: "domcontentloaded" });
  const cover = page.locator("main img");
  await expect(cover).toHaveCount(1);
  await expect(cover).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("img", { name: TITLE }).getByText(TITLE)).toBeVisible();
});
