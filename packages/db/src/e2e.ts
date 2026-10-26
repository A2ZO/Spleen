import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { rowsOf } from "./rows";

/*
 * Accounts created by the Playwright suite (`apps/web/e2e/helpers.ts`): email
 * `e2e-<id>@example.test`, username `e2e_<id>`. `.test` is a reserved domain: no real member
 * can receive a magic link there, so these accounts are always throwaway.
 */
const E2E_EMAIL = /^e2e-[a-z0-9]+@example\.test$/;

/** Whether `email` belongs to an e2e test account. */
export const isE2eEmail = (email: string) => E2E_EMAIL.test(email.toLowerCase());

/**
 * Whether a deleted account's usernames are freed at once instead of staying reserved: e2e
 * accounts, in development and tests only (`NODE_ENV`). Never in production, whatever the
 * email looks like.
 */
export const freesUsernamesAtOnce = (email: string, env: NodeJS.ProcessEnv = process.env) =>
  (env.NODE_ENV === "development" || env.NODE_ENV === "test") && isE2eEmail(email);

/**
 * Deletes every e2e account with its data (cascade), then the username reservations e2e
 * accounts left behind. Returns how many accounts were deleted.
 */
export async function deleteE2eAccounts(db: Db): Promise<number> {
  return db.transaction(async (tx) => {
    const deleted = await tx.execute(
      sql`delete from "user" where lower("email") ~ '^e2e-[a-z0-9]+@example[.]test$' returning "id"`,
    );
    await tx.execute(sql`delete from "username_history" where "username" ~ '^e2e_[a-z0-9]+$'`);
    return rowsOf(deleted).length;
  });
}
