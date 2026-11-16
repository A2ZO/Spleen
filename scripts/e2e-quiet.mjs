// `pnpm e2e:quiet [playwright args]`: the e2e suite through Turbo, errors only, then one
// summary line (passed, failed, flaky, skipped, duration) written by
// `apps/web/e2e/summary-reporter.ts`. Keeps Turbo's exit code.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const summaryFile = path.join(root, "apps", "web", "test-results", "e2e-summary.json");
rmSync(summaryFile, { force: true });

const args = [
  "exec",
  "turbo",
  "run",
  "e2e",
  "--output-logs=errors-only",
  "--",
  "--reporter=dot,./e2e/summary-reporter.ts",
  ...process.argv.slice(2),
];
const run = spawnSync("pnpm", args, { cwd: root, stdio: "inherit", shell: true });

if (existsSync(summaryFile)) {
  const s = JSON.parse(readFileSync(summaryFile, "utf8"));
  const seconds = Math.round(s.durationMs / 1000);
  const time = `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
  console.log(
    `e2e : ${s.passed} réussis · ${s.failed} échoués · ${s.flaky} instables · ` +
      `${s.skipped} ignorés · ${time}`,
  );
} else {
  console.log("e2e : pas de résumé (le passage s'est arrêté avant la fin)");
}
process.exit(run.status ?? 1);
