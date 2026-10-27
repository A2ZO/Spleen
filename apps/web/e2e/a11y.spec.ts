import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "./fixtures";

import { grantAdmin, signUp } from "./helpers";

test.use({ locale: "fr-FR" });

/** Serious and critical axe violations of the page, as readable lines (WCAG 2.1 A and AA). */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.target.join(" ")}`));
}

const PUBLIC_PAGES = [
  "/fr",
  "/fr/search?q=pluie",
  "/fr/album/nocturnes-pour-pluie-fine",
  "/fr/u/nuitblanche",
  "/fr/list/00000000-0000-4000-8000-000000043002",
  "/fr/discover",
  "/fr/legal",
];

for (const path of PUBLIC_PAGES) {
  test(`no serious or critical accessibility issue on ${path}`, async ({ page }) => {
    await page.goto(path);
    expect(await violations(page)).toEqual([]);
  });
}

test("no serious or critical accessibility issue in the moderation area", async ({
  page,
}, testInfo) => {
  const moderator = await signUp(page, testInfo, "Auditrice");
  test.skip(!(await grantAdmin(moderator)), "needs the Postgres database of the dev server");
  await page.goto("/fr/admin");
  expect(await violations(page)).toEqual([]);
});
