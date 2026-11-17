// `pnpm vitrine`: starts the vitrine, Spleen with real data only (docs/environnement.md).
// Runs only in a secondary git worktree (`../Spleen-vitrine`) whose `.env` holds
// SPLEEN_VITRINE=1 and the URLs of the Neon branch `vitrine`. Without local changes, it first
// moves the folder to the latest `dev` (detached); then installs, migrates and serves the site
// on port 3001, so that the main folder keeps port 3000.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 3001;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`vitrine: ${message}`);
  process.exit(1);
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail(`git ${args.join(" ")} failed.\n${result.stderr.trim()}`);
  return result.stdout.trim();
}

function run(command) {
  console.log(`vitrine: ${command}`);
  const result = spawnSync(command, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) fail(`${command} failed.`);
}

// A secondary worktree has its own git dir inside the main one's common dir.
const gitDir = path.resolve(root, git("rev-parse", "--git-dir"));
const commonDir = path.resolve(root, git("rev-parse", "--git-common-dir"));
if (gitDir === commonDir) {
  fail(
    "refuses to run in the main folder. Run it in the vitrine worktree (../Spleen-vitrine), " +
      "see docs/environnement.md.",
  );
}

const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (process.env.SPLEEN_VITRINE?.trim() !== "1") {
  fail("SPLEEN_VITRINE=1 is missing from this folder's .env: this is not the vitrine.");
}

if (git("status", "--porcelain") === "") {
  run("git fetch origin");
  run("git switch --detach origin/dev");
} else {
  console.warn("vitrine: local changes, the folder stays on its current version.");
}
run("pnpm install --frozen-lockfile");
run("pnpm db:migrate");
run(`pnpm --filter @spleen/web dev --port ${PORT}`);
