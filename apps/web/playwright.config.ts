import { defineConfig, devices } from "@playwright/test";

// Same port as `pnpm dev`: Next allows one dev server per app, so a running one is reused.
const PORT = 3000;
// Set PLAYWRIGHT_CHANNEL=chrome to use the installed Chrome instead of downloading Chromium.
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  // Deletes the e2e accounts before (left by an interrupted run) and after the suite, and
  // fails the run on known errors in the dev server log (`e2e/server-log.ts`).
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/fr`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
