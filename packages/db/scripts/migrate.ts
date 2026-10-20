import { createDb } from "../src/client";

const handle = createDb();
try {
  await handle.migrate();
  console.log(`db: migrations applied (${handle.kind})`);
} finally {
  await handle.close();
}
