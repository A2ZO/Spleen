import { expect, test } from "./fixtures";

test.use({ locale: "fr-FR" });

const ALBUM = "/fr/album/i-never-loved-a-man-the-way-i-love-you";
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

test("a cover that fails to load gives way to the generated sleeve", async ({ page }) => {
  await page.route("https://coverartarchive.org/**", (route) => route.fulfill({ status: 500 }));
  await page.goto(ALBUM);
  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /I Never Loved a Man/ })).toBeVisible();
});
