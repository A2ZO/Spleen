import { defineConfig } from "drizzle-kit";

import { loadRootEnv } from "./src/env";

loadRootEnv();

// `generate` needs no database. Commands that connect (e.g. `drizzle-kit studio`) use the
// direct connection; migrations are applied by our own script (PGlite or Postgres).
const url = process.env.DATABASE_URL_UNPOOLED;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  ...(url ? { dbCredentials: { url } } : {}),
});
