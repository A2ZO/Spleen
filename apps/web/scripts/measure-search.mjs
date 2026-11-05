// Search timing, as a visitor (no sign-in): last keystroke → results shown, in Chrome, on the
// search page field. Then, if the suggestion route exists, its server cost per call (median of
// the Server-Timing header, CPU as a mean, sent only when the server runs with SPLEEN_QUERY_TRACE=1).
// Usage (from apps/web, server already running): node scripts/measure-search.mjs [baseURL] [runs]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const runs = Number(process.argv[3] ?? 6);
const queries = ["noct", "beton", "paper m"];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
};

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const page = await (await browser.newContext({ locale: "fr-FR" })).newPage();

let requests = 0;
page.on("request", (req) => {
  const h = req.headers();
  if (h["next-router-prefetch"] || req.resourceType() === "image") return;
  if (h.rsc === "1" || req.url().includes("/api/search/suggest")) requests++;
});

/** Results are in: the field's suggestion count is announced, or (former page) the results heading for `q`. */
const shown = (q) =>
  page.waitForFunction(
    (text) =>
      document.querySelector("main [role=status]")?.textContent ||
      [...document.querySelectorAll("main h2")].some((h) => h.textContent?.includes(`« ${text} »`)),
    q,
    { polling: 5, timeout: 15_000 },
  );

const rows = queries.map((q) => ({ q, cold: NaN, ms: [], requests: 0 }));
for (let run = 0; run < runs; run++) {
  for (const row of rows) {
    await page.goto(`${base}/fr/search`);
    await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 90_000 });
    await page.waitForLoadState("networkidle");
    const field = page.locator('main input[name="q"]');
    await field.click();
    requests = 0;
    await field.pressSequentially(row.q, { delay: 70 });
    const t0 = Date.now();
    await shown(row.q);
    const dt = Date.now() - t0;
    await page.waitForLoadState("networkidle");
    if (run === 0) row.cold = dt;
    else row.ms.push(dt);
    row.requests = Math.max(row.requests, requests);
  }
}

// Server pass: the suggestion route alone (no CDN locally: every call reaches the server).
const server = [];
const probe = await fetch(`${base}/api/search/suggest?q=noct`);
if (probe.status !== 404) {
  for (const q of queries) {
    const samples = [];
    for (let k = 0; k < 32; k++) {
      // Under the per-IP limit (3 per second after a burst of 30).
      await new Promise((resolve) => setTimeout(resolve, 400));
      const t0 = performance.now();
      const res = await fetch(`${base}/api/search/suggest?q=${encodeURIComponent(q)}`);
      const bytes = (await res.arrayBuffer()).byteLength;
      const total = performance.now() - t0;
      const timing = Object.fromEntries(
        (res.headers.get("server-timing") ?? "")
          .split(",")
          .map((part) => /^\s*(\w+);dur=([\d.]+)/.exec(part))
          .filter(Boolean)
          .map((m) => [m[1], Number(m[2])]),
      );
      if (k > 1) samples.push({ total, bytes, ...timing });
    }
    const pick = (key) => Math.round(median(samples.map((s) => s[key] ?? NaN)) * 10) / 10;
    // CPU time: mean, since Windows counts it in ~15.6 ms ticks (a median is often 0).
    const mean = (key) =>
      Math.round((samples.reduce((n, s) => n + (s[key] ?? 0), 0) / samples.length) * 10) / 10;
    server.push({
      q,
      totalMs: pick("total"),
      baseMs: pick("db"),
      cpuMs: mean("cpu"),
      octets: pick("bytes"),
    });
  }
}

console.table(
  rows.map((r) => ({
    q: r.q,
    froidMs: r.cold,
    affichageMs: median(r.ms),
    requetes: r.requests,
  })),
);
if (server.length) console.table(server);
await browser.close();
