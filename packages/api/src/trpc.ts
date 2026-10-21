import type { Db } from "@spleen/db";
import type { Storage } from "@spleen/infra/storage";
import { initTRPC, TRPCError } from "@trpc/server";

import type { ApiErrorCode } from "./errors";

/** The signed-in member, as resolved by the auth layer (cookie on web, Cookie header on Expo). */
export interface SessionUser {
  id: string;
  email: string;
}

/** Request context; `now` is injectable so date-based logic stays testable. */
export interface Context {
  now: Date;
  /** Database, opened on first use: procedures that only read fixtures never connect. */
  db: () => Db;
  /** Session of the caller, resolved on first use (memoised by `createContext`). */
  user: () => Promise<SessionUser | null>;
  /** File storage (avatars), created on first use. */
  storage: () => Storage;
}

export interface ContextOptions {
  db: () => Db;
  user?: () => Promise<SessionUser | null>;
  storage?: () => Storage;
  now?: Date;
}

const once = <T>(fn: () => T): (() => T) => {
  let value: { v: T } | undefined;
  return () => (value ??= { v: fn() }).v;
};

export function createContext(options: ContextOptions): Context {
  return {
    now: options.now ?? new Date(),
    db: options.db,
    user: once(options.user ?? (async () => null)),
    storage: once(
      options.storage ??
        (() => {
          throw new Error("No storage configured for this context.");
        }),
    ),
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/** Throws a tRPC error whose message is a stable code the clients translate. */
export function fail(code: TRPCError["code"], message: ApiErrorCode): never {
  throw new TRPCError({ code, message });
}

/** Procedures for signed-in members: `ctx.user` is guaranteed. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const user = await ctx.user();
  if (!user) fail("UNAUTHORIZED", "UNAUTHENTICATED");
  return next({ ctx: { ...ctx, user } });
});
