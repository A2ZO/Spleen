import { initTRPC } from "@trpc/server";

/**
 * Request context. Auth (cookie for web, bearer token for Expo) will add the session here
 * in milestone 3; `now` is injectable so date-based logic stays testable.
 */
export interface Context {
  now: Date;
}

export function createContext(): Context {
  return { now: new Date() };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
