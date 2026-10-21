import { rmSync } from "node:fs";

import { createDb, defaultPgliteDir, isPostgresUrl } from "../src/client";
import { loadRootEnv } from "../src/env";
import { seed } from "../src/seed/seed";

loadRootEnv();

// Safety: only the local PGlite database can be wiped by this script.
if (isPostgresUrl(process.env.DATABASE_URL)) {
  console.error(
    "db:reset only works on the local PGlite database. Comment out DATABASE_URL in .env.",
  );
  process.exit(1);
}

const dir = process.env.DATABASE_URL ?? defaultPgliteDir;
rmSync(dir, { recursive: true, force: true });

const handle = createDb(dir);
try {
  await handle.migrate();
  await seed(handle.db);
  console.log(`db: local PGlite database reset and seeded (${dir})`);
} finally {
  await handle.close();
}
