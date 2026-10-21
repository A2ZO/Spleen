import { createDb, migrationDatabaseUrl } from "../src/client";
import { loadRootEnv } from "../src/env";

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
try {
  await handle.migrate();
  console.log(`db: migrations applied (${handle.kind})`);
} finally {
  await handle.close();
}
