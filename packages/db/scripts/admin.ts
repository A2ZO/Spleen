import { setAdminRole, type AdminRoleResult } from "../src/admin";
import { createDb, migrationDatabaseUrl } from "../src/client";
import { loadRootEnv } from "../src/env";

// pnpm admin:grant <email> | pnpm admin:revoke <email>, on the database of the environment
// (DATABASE_URL_UNPOOLED, else DATABASE_URL, else the local PGlite database).
const [command, email] = process.argv.slice(2);
if ((command !== "grant" && command !== "revoke") || !email) {
  console.error("Usage: pnpm admin:grant <email> | pnpm admin:revoke <email>");
  process.exit(1);
}

const MESSAGES: Record<AdminRoleResult, string> = {
  granted: "admin role granted",
  revoked: "admin role revoked",
  unchanged: "nothing to do (role already set)",
  "no-account": "no account with this email",
  "no-profile": "this account has no profile yet: sign in and pick a @username first",
};

loadRootEnv();
const handle = createDb(migrationDatabaseUrl());
try {
  const result = await setAdminRole(handle.db, email, command === "grant");
  console.log(`admin (${handle.kind}): ${MESSAGES[result]}.`);
  if (result === "no-account" || result === "no-profile") process.exitCode = 1;
} finally {
  await handle.close();
}
