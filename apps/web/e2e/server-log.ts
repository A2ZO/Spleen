import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/*
 * Server log check: the run fails when the dev server logged an error that no assertion can
 * see from the browser. Setup notes where the log ends (a reused dev server keeps older
 * lines); teardown scans what the suite added and prints counts only, never the lines
 * (they can hold error details).
 */

const log = path.resolve(import.meta.dirname, "../.next/dev/logs/next-development.log");
const OFFSET = "SPLEEN_E2E_SERVER_LOG_OFFSET";

const KNOWN = {
  // A render cut mid-stream: a second request (client refresh) cancelled by the router, or a
  // test leaving a page before its navigation ended.
  "The destination stream errored": "render cancelled mid-stream",
  // A manifest read half-written while another route compiled (`generateStaticParams`).
  "Unexpected end of JSON input": "half-written JSON read",
};

async function size(): Promise<number> {
  return (await stat(log).catch(() => null))?.size ?? 0;
}

export async function markServerLog() {
  process.env[OFFSET] = String(await size());
}

export async function checkServerLog() {
  const offset = Number(process.env[OFFSET] ?? 0);
  const content = await readFile(log).catch(() => null);
  if (!content) return;
  // A new dev server started a new log: everything in it belongs to this run.
  const text = content.subarray(content.length >= offset ? offset : 0).toString("utf8");
  const found = Object.entries(KNOWN)
    .map(([needle, label]) => [label, text.split(needle).length - 1] as const)
    .filter(([, count]) => count > 0);
  if (found.length > 0) {
    const summary = found.map(([label, count]) => `${count} × ${label}`).join(", ");
    throw new Error(`[e2e] The dev server logged errors during the run: ${summary}.`);
  }
}
