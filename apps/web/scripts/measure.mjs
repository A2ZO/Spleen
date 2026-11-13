// Navigation timing on 5 member paths (home → album → artist → profile → discover → home):
// real clicks in Chrome, then each page's RSC request replayed alone with its SQL trace.
// Usage (from apps/web, server already running): node scripts/measure.mjs [baseURL] [runs]
// SQL columns need the dev server started with SPLEEN_QUERY_TRACE=1 (docs/environnement.md);
// against a production build they stay empty. Signs in nuitblanche@example.test (demo seed)
// through the dev outbox, so it needs Brevo unset, like e2e.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const outbox = path.resolve(here, "../../../.data/outbox");
const base = process.argv[2] ?? "http://localhost:3000";
const runs = Number(process.argv[3] ?? 6);
const email = "nuitblanche@example.test";

const steps = [
  { name: "accueil→album", sel: 'main a[href*="/album/"]:visible', url: /\/album\// },
  { name: "album→artiste", sel: 'main a[href*="/artist/"]:visible', url: /\/artist\// },
  { name: "artiste→profil", sel: 'a[href*="/u/"]:visible', url: /\/u\// },
  { name: "profil→discover", sel: 'a[href$="/discover"]:visible', url: /\/discover$/ },
  { name: "discover→accueil", sel: 'header a[href="/fr"]:visible', url: /\/fr$/ },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
};

/** Queries, waves (round trips in series: the in-flight count rises from 0) and time in base. */
function sqlStats(entries) {
  const done = entries.filter((e) => e.end != null).sort((a, b) => a.start - b.start);
  let waves = 0;
  let dbMs = 0;
  let from = 0;
  let to = -Infinity;
  for (const e of done) {
    if (e.start >= to) {
      if (to > -Infinity) dbMs += to - from;
      waves++;
      from = e.start;
      to = e.end;
    } else to = Math.max(to, e.end);
  }
  if (to > -Infinity) dbMs += to - from;
  return { queries: done.length, waves, dbMs };
}

async function signIn(page) {
  const before = new Set(await readdir(outbox).catch(() => []));
  await page.goto(`${base}/fr/sign-in`);
  // A cold dev server compiles and reloads the page once: allow for it.
  await page.locator("html[data-hydrated]").waitFor({ state: "attached", timeout: 90_000 });
  await page.getByLabel("Ton email").fill(email);
  await page.getByRole("button", { name: "Recevoir mon lien" }).click();
  for (let i = 0; i < 50; i++) {
    const fresh = (await readdir(outbox)).filter(
      (f) => !before.has(f) && f.includes("nuitblanche"),
    );
    if (fresh.length) {
      const mail = JSON.parse(await readFile(path.join(outbox, fresh.sort().at(-1)), "utf8"));
      const link = /https?:\/\/\S+/.exec(mail.text)[0];
      await page.goto(link.replace(/^https?:\/\/[^/]+/, base));
      await page.waitForLoadState("networkidle");
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("No magic link in .data/outbox (is Brevo unset?)");
}

// MEASURE_STATE=<file>: reuse a session saved by an earlier run (a production build sends
// no email to the dev outbox, so sign in once against `pnpm dev`, then measure the build).
const statePath = process.env.MEASURE_STATE;
const saved = statePath && existsSync(statePath);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const context = await browser.newContext({
  locale: "fr-FR",
  storageState: saved ? statePath : undefined,
});
const page = await context.newPage();
if (!saved) {
  await signIn(page);
  if (statePath) await context.storageState({ path: statePath });
}

// Browser pass: click → URL change, and click → page shown (its heading). Run 0 is cold.
const nav = steps.map(() => ({ cold: NaN, clickMs: [], shownMs: [], prefetches: 0, req: null }));
let current = null;
page.on("request", (req) => {
  const h = req.headers();
  if (!current || h.rsc !== "1" || req.method() !== "GET") return;
  if (h["next-router-prefetch"]) current.prefetches++;
  else current.reqs.push(req);
});

for (let run = 0; run < runs; run++) {
  await page.goto(`${base}/fr`);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.waitForLoadState("networkidle");
  for (let i = 0; i < steps.length; i++) {
    const target = page.locator(steps[i].sel).first();
    await target.waitFor();
    current = { reqs: [], prefetches: 0 };
    const t0 = Date.now();
    await target.click();
    await page.waitForURL(steps[i].url, { waitUntil: "commit" });
    const dt = Date.now() - t0;
    // Page shown: the new page's heading is in.
    await page.waitForFunction(() => document.querySelector("main h1"), undefined, { polling: 10 });
    const shown = Date.now() - t0;
    await page.waitForLoadState("networkidle");
    // Prefetches fired by the page just reached (its viewport links).
    nav[i].prefetches = Math.max(nav[i].prefetches, current.prefetches);
    const r = current.reqs.at(-1);
    if (r) nav[i].req = { url: r.url(), headers: await r.allHeaders() };
    if (run === 0) nav[i].cold = shown;
    else {
      nav[i].clickMs.push(dt);
      nav[i].shownMs.push(shown);
    }
    current = null;
    await page.waitForTimeout(300);
  }
}

// Server pass: replay each RSC request alone (first replay discarded) and read the trace.
const tracing = (await fetch(`${base}/api/trace-debug`)).ok;
const cookie = (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const rows = [];
for (let i = 0; i < steps.length; i++) {
  const samples = [];
  const req = nav[i].req;
  for (let k = 0; req && k < 6; k++) {
    if (tracing) await fetch(`${base}/api/trace-debug`);
    const headers = { ...req.headers, cookie };
    delete headers["content-length"];
    const t0 = performance.now();
    const res = await fetch(req.url, { headers });
    await res.arrayBuffer();
    const total = performance.now() - t0;
    const trace = tracing ? await (await fetch(`${base}/api/trace-debug`)).json() : [];
    if (k > 0) samples.push({ total, ...sqlStats(trace) });
  }
  const pick = (key) => Math.round(median(samples.map((s) => s[key])));
  rows.push({
    parcours: steps[i].name,
    clicFroidMs: nav[i].cold,
    clicMs: median(nav[i].clickMs),
    pageMs: median(nav[i].shownMs),
    serveurMs: pick("total"),
    prefetch: nav[i].prefetches,
    ...(tracing ? { sql: pick("queries"), vagues: pick("waves"), baseMs: pick("dbMs") } : {}),
  });
}
console.table(rows);
await browser.close();
