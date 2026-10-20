import { defineConfig } from "drizzle-kit";

// Only `generate` is used: migrations are applied by our own script (PGlite or Postgres).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
});
