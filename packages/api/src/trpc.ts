import type { Db } from "@spleen/db";
import { initTRPC } from "@trpc/server";

/**
 * Request context. Auth (cookie for web, bearer token for Expo) will add the session here
 * in milestone 3; `now` is injectable so date-based logic stays testable.
 */
export interface Context {
  now: Date;
  /** Database, opened on first use: procedures that only read fixtures never connect. */
  db: () => Db;
}

export function createContext(db: () => Db): Context {
  return { now: new Date(), db };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
