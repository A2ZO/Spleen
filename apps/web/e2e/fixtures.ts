import { test as base, type BrowserContext } from "@playwright/test";

export { expect, type Browser, type Locator, type Page, type TestInfo } from "@playwright/test";

/*
 * Every spec imports `test` from here: a Content Security Policy violation reported in the
 * console of any page (the default context and the ones a test opens itself) fails the test.
 */
export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ browser, context }, run) => {
      const violations: string[] = [];
      const watch = (watched: BrowserContext) =>
        watched.on("console", (message) => {
          const text = message.text();
          if (text.includes("Content Security Policy")) violations.push(text);
        });
      watch(context);
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (options) => {
        const opened = await newContext(options);
        watch(opened);
        return opened;
      };
      try {
        await run();
      } finally {
        browser.newContext = newContext;
      }
      if (violations.length > 0) {
        throw new Error(`Content Security Policy violation(s):\n${violations.join("\n")}`);
      }
    },
    { auto: true },
  ],
});
