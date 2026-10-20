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
