import { cleanDemo, cleanDemoRefusal } from "../src/clean-demo";
import { createDb, migrationDatabaseUrl } from "../src/client";
import { loadRootEnv } from "../src/env";

// pnpm db:clean-demo [--yes]: empties the vitrine of the demo and e2e data
// (`src/clean-demo.ts`). Without --yes, only prints the counts.
loadRootEnv();
const apply = process.argv.includes("--yes");
const url = migrationDatabaseUrl();
const refusal = [url, process.env.DATABASE_URL]
  .map((u) => cleanDemoRefusal(u))
  .find((r) => r !== null);
if (refusal) {
  console.error(`db:clean-demo refuses to run: ${refusal}.`);
  process.exit(1);
}

const handle = createDb(url);
try {
  const { deleted, realMemberRows } = await cleanDemo(handle.db, { apply });
  const tables = Object.entries(deleted);
  console.log(apply ? "db:clean-demo: deleted rows" : "db:clean-demo: rows to delete (dry run)");
  for (const [table, n] of tables) console.log(`  ${table.padEnd(24)} ${n}`);
  if (tables.length === 0) console.log("  nothing to delete");
  if (realMemberRows > 0) {
    console.log(
      `  ! ${realMemberRows} row(s) of members outside @example.test on fictional records`,
    );
  }
  if (!apply) console.log("Nothing changed. Run `pnpm db:clean-demo -- --yes` to delete.");
} finally {
  await handle.close();
}
