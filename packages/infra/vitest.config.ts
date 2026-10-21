import { defineConfig } from "vitest/config";

import { loadRootEnv } from "@spleen/db/env";

// Tests see `<repo>/.env` like the rest of the monorepo, but never a remote database:
// DATABASE_URL is forced to in-memory PGlite.
loadRootEnv();

export default defineConfig({
  test: { env: { DATABASE_URL: "memory://" } },
});
