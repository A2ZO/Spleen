import "server-only";

import { createAuth, getSessionUser, type Auth } from "@spleen/auth";
import type { SessionUser } from "@spleen/api";

import { getDb } from "./db";

const globalForAuth = globalThis as typeof globalThis & { spleenAuth?: Auth };

/** One Better Auth instance per server process (shares the database pool). */
export function getAuth(): Auth {
  globalForAuth.spleenAuth ??= createAuth({ db: getDb() });
  return globalForAuth.spleenAuth;
}

export async function sessionUserFrom(headers: Headers): Promise<SessionUser | null> {
  return getSessionUser(getAuth(), headers);
}
