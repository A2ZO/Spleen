import { createDb } from "../src/client";
import { seed } from "../src/seed/seed";

// Migrations are idempotent, so seeding a fresh database works in one step.
const handle = createDb();
try {
  await handle.migrate();
  await seed(handle.db);
  console.log(`db: demo data seeded (${handle.kind})`);
} finally {
  await handle.close();
}
