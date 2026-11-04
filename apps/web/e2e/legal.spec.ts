import { expect, test } from "./fixtures";

test.describe("in French", () => {
  test.use({ locale: "fr-FR" });

  test("the legal pages open from the footer", async ({ page }) => {
    await page.goto("/fr");
    const footer = page.getByRole("navigation", { name: "Informations légales" });
    for (const [link, heading] of [
      ["Mentions légales", "Mentions légales"],
      ["Conditions d'utilisation", "Conditions d'utilisation"],
      ["Confidentialité", "Politique de confidentialité"],
    ] as const) {
      await footer.getByRole("link", { name: link }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
    await footer.getByRole("link", { name: "Crédits" }).click();
    const credits = page.getByRole("region", { name: "Crédits et données musicales" });
    await expect(credits.getByRole("link", { name: "MusicBrainz", exact: true })).toBeVisible();
    await expect(
      credits.getByRole("link", { name: "Creative Commons BY-NC-SA 3.0" }),
    ).toHaveAttribute("href", "https://creativecommons.org/licenses/by-nc-sa/3.0/");
    await expect(credits.getByRole("link", { name: "Cover Art Archive" })).toBeVisible();
  });
});

test.describe("in English", () => {
  test.use({ locale: "en-US" });

  test("the privacy policy lists only necessary cookies", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
    const cookies = page.getByRole("region", { name: "Cookies" });
    await expect(cookies.getByText("spleen-theme")).toBeVisible();
    await expect(cookies.getByText("NEXT_LOCALE")).toBeVisible();
  });
});
