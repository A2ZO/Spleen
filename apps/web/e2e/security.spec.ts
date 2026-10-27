import { expect, test } from "./fixtures";

test.use({ locale: "fr-FR" });

test("pages carry a fresh nonce policy, files the static security headers", async ({ request }) => {
  const policies = [];
  for (let i = 0; i < 2; i++) {
    const page = await request.get("/fr");
    const csp = page.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://*.archive.org");
    const nonce = csp.match(/'nonce-([^']+)'/)![1];
    expect(await page.text()).toContain(`nonce="${nonce}"`);
    policies.push(csp);
  }
  expect(policies[0]).not.toBe(policies[1]);

  const worker = await request.get("/sw.js");
  expect(worker.headers()["x-content-type-options"]).toBe("nosniff");
  expect(worker.headers()["strict-transport-security"]).toContain("max-age=");
  expect(worker.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(worker.headers()["permissions-policy"]).toContain("camera=()");
});

test("the policy lets the Google sign-in leave for accounts.google.com", async ({ page }) => {
  // Google is not configured locally: same step as Better Auth's client after its fetch
  // (`window.location.href = url`), towards a stubbed Google.
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Google</h1>" }),
  );
  await page.goto("/fr/sign-in");
  await page.evaluate(() => {
    window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?client_id=stub";
  });
  await expect(page.getByRole("heading", { name: "Google" })).toBeVisible();
});

test("an injected inline script is refused, and the guard fails the test", async ({ page }) => {
  // The shared fixture must turn the console report into a failure: expected here.
  test.fail();
  await page.goto("/fr");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "document.body.dataset.injected = 'yes'";
    document.body.append(script);
  });
  await expect(page.locator("body")).not.toHaveAttribute("data-injected", "yes");
});
