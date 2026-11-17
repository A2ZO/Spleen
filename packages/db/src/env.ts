import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The single secrets file of the monorepo: `<repo>/.env` (git-ignored). */
export const rootEnvFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
);

/**
 * Loads `<repo>/.env` into `process.env` when it exists (local development).
 * Variables already set (CI, hosting provider) always win: Node never overrides them.
 */
export function loadRootEnv(): void {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}

/**
 * The vitrine: a secondary worktree whose `.env` points at the Neon branch `vitrine`, which
 * holds real data only (MusicBrainz catalog, real accounts). Set by `SPLEEN_VITRINE=1`.
 */
export const isVitrine = (env: NodeJS.ProcessEnv = process.env) =>
  env.SPLEEN_VITRINE?.trim() === "1";

/**
 * Why `task` (demo data, e2e) must not run here, or null when it may: it would write
 * fictional data into the vitrine or delete accounts from it.
 */
export function vitrineRefusal(task: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isVitrine(env)) return null;
  return (
    `${task} refuses to run in the vitrine (SPLEEN_VITRINE=1): its database holds real data ` +
    "only. Run it from the main folder, on the Neon branch dev."
  );
}
