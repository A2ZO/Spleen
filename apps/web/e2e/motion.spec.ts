import { expect, test, type Page } from "./fixtures";

test.use({ locale: "fr-FR" });

/* Motion (docs/design/README.md, « Mouvement »): never content hidden behind an animation. */

const ALBUM = "/fr/album/nocturnes-pour-pluie-fine";

/** Opacity and running animations of every element matching `selector`. */
function stateOf(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => ({
      opacity: getComputedStyle(node).opacity,
      display: getComputedStyle(node).display,
      animations: node.getAnimations().length,
    })),
  );
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("trend tiles are visible and still, before and after scrolling", async ({ page }) => {
    await page.goto("/fr");
    const tiles = page.locator(".scroll-cascade");
    await expect(tiles.first()).toBeVisible();
    await tiles.last().scrollIntoViewIfNeeded();
    for (const tile of await stateOf(page, ".scroll-cascade")) {
      expect(tile).toMatchObject({ opacity: "1", animations: 0 });
    }
  });

  test("the phone cover stays whole and the bar thumbnail hidden", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ALBUM);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await stateOf(page, ".cover-scroll > *")).toEqual([
      { opacity: "1", display: "block", animations: 0 },
    ]);
    expect((await stateOf(page, ".cover-thumb"))[0]?.display).toBe("none");
  });

  test("profile figures show their value", async ({ page }) => {
    await page.goto("/fr/u/nuitblanche");
    const figures = page.locator("[data-count-up]");
    await expect(figures.first()).toBeVisible();
    for (const figure of await figures.all()) {
      const value = await figure.evaluate((node) => node.previousElementSibling?.textContent);
      await expect(figure).toHaveText(value ?? "");
    }
  });
});

test("trend tiles stay opaque and end in place once scrolled into view", async ({ page }) => {
  await page.goto("/fr");
  for (const tile of await stateOf(page, ".scroll-cascade")) expect(tile.opacity).toBe("1");
  const last = page.locator(".scroll-cascade").last();
  await last.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 300);
  // At rest: no transform, or the identity matrix the animation interpolates to.
  await expect
    .poll(() => last.evaluate((node) => getComputedStyle(node).transform))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
});

test("on a phone, the cover thumbnail appears in the bar once the cover is gone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ALBUM);
  const thumb = page.locator(".cover-thumb");
  await expect.poll(() => thumb.evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
  await page.mouse.wheel(0, 900);
  await expect
    .poll(() => thumb.evaluate((node) => Number(getComputedStyle(node).opacity)))
    .toBeGreaterThan(0.99);
});
