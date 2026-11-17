import { createDb, migrationDatabaseUrl } from "../src/client";
import { loadRootEnv, vitrineRefusal } from "../src/env";
import { seed } from "../src/seed/seed";

// Migrations are idempotent, so seeding a fresh database works in one step.
loadRootEnv();
const refusal = vitrineRefusal("db:seed");
if (refusal) {
  console.error(refusal);
  process.exit(1);
}
const handle = createDb(migrationDatabaseUrl());
try {
  await handle.migrate();
  await seed(handle.db);
  console.log(`db: demo data seeded (${handle.kind})`);
} finally {
  await handle.close();
}
