import { createDb, migrationDatabaseUrl } from "../src/client";
import { loadRootEnv } from "../src/env";
import { seed } from "../src/seed/seed";

// Migrations are idempotent, so seeding a fresh database works in one step.
loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
try {
  await handle.migrate();
  await seed(handle.db);
  console.log(`db: demo data seeded (${handle.kind})`);
} finally {
  await handle.close();
}
