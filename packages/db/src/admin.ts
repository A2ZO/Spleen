import { eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { profiles, user } from "./schema";

export type AdminRoleResult = "granted" | "revoked" | "unchanged" | "no-account" | "no-profile";

/**
 * Grants or revokes the admin role of the account using `email`. Only the command line calls
 * it (`pnpm admin:grant` / `admin:revoke`): no route or procedure can change a role. The
 * account must have a profile (the role lives there): sign in and pick a @username first.
 */
export async function setAdminRole(
  db: Db,
  email: string,
  admin: boolean,
): Promise<AdminRoleResult> {
  const [account] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email.trim().toLowerCase()));
  if (!account) return "no-account";
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.userId, account.id));
  if (!profile) return "no-profile";
  const role = admin ? "admin" : "member";
  if (profile.role === role) return "unchanged";
  await db.update(profiles).set({ role }).where(eq(profiles.userId, account.id));
  return admin ? "granted" : "revoked";
}
