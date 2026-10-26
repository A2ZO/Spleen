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

/** Neon endpoint id (`ep-…`) of a host or URL, the same for its pooled and direct addresses. */
export function neonEndpointId(hostOrUrl: string): string | null {
  let host = hostOrUrl.trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    return null;
  }
  const endpoint = host.split(".")[0]?.replace(/-pooler$/, "") ?? "";
  return endpoint.startsWith("ep-") ? endpoint : null;
}

/**
 * Why the e2e cleanup must not touch the database at `url`, or null when it may. It deletes
 * accounts, so it refuses production (`NODE_ENV`), Neon's `production` branch (`NEON_MAIN_HOST`,
 * its pooled or direct host, or its endpoint id), and any Neon host while that variable is
 * missing, since it is then impossible to tell `dev` from `production`.
 */
export function unsafeE2eDatabase(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.NODE_ENV === "production") return "NODE_ENV is production";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "the database URL cannot be parsed";
  }
  if (!host.endsWith(".neon.tech")) return null;
  const production = env.NEON_MAIN_HOST?.trim();
  if (!production) return "Neon database and NEON_MAIN_HOST is not set";
  const productionEndpoint = neonEndpointId(production);
  if (!productionEndpoint) return "NEON_MAIN_HOST is not a Neon host or endpoint id";
  if (neonEndpointId(host) === productionEndpoint) return "this is Neon's production branch";
  return null;
}
