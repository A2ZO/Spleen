// Claude Code status line for this repo (`.claude/settings.json`, `statusLine`). Claude Code
// sends a JSON on stdin; when it holds `rate_limits` (subscribers only, after the first answer
// of a session), the 5-hour and 7-day windows are saved to `.git/pilote-usage.json`, which the
// autopilot (`/pilote`) reads to keep a credit reserve. The same JSON is then handed to the
// member's own status line (`~/.claude/statusline.js`) so it stays visible here; without one,
// only the percentages are shown. Never throws: a status line must always print something.
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const usageFile = path.join(root, ".git", "pilote-usage.json");
const ownStatusLine = path.join(homedir(), ".claude", "statusline.js");

function readStdin() {
  const chunks = [];
  return new Promise((resolve) => {
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", () => resolve(""));
  });
}

function windowOf(limits, name) {
  const w = limits?.[name];
  if (!w || typeof w.used_percentage !== "number") return null;
  return { used_percentage: w.used_percentage, resets_at: w.resets_at ?? null };
}

function saveUsage(fiveHour, sevenDay) {
  try {
    const tmp = `${usageFile}.tmp`;
    const body = { five_hour: fiveHour, seven_day: sevenDay, written_at: new Date().toISOString() };
    writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
    renameSync(tmp, usageFile);
  } catch {
    // No `.git` folder (a worktree, an export): nothing to save.
  }
}

function percentages(fiveHour, sevenDay) {
  const parts = [];
  if (fiveHour) parts.push(`5h ${Math.round(fiveHour.used_percentage)} %`);
  if (sevenDay) parts.push(`7j ${Math.round(sevenDay.used_percentage)} %`);
  return parts.join(" · ");
}

function ownLine(raw) {
  if (!existsSync(ownStatusLine)) return null;
  const result = spawnSync(process.execPath, [ownStatusLine], {
    input: raw,
    encoding: "utf8",
    timeout: 3000,
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) return null;
  return result.stdout.replace(/\s+$/, "");
}

const raw = await readStdin();
let data = {};
try {
  data = JSON.parse(raw);
} catch {
  // Malformed input: show what we can.
}

const fiveHour = windowOf(data.rate_limits, "five_hour");
const sevenDay = windowOf(data.rate_limits, "seven_day");
if (fiveHour || sevenDay) saveUsage(fiveHour, sevenDay);

process.stdout.write(`${ownLine(raw) ?? percentages(fiveHour, sevenDay)}\n`);
