import type { CatalogProvider } from "@spleen/catalog";
import { eq, schema, type Db } from "@spleen/db";
import type { Mailer } from "@spleen/infra/email";
import type { Storage } from "@spleen/infra/storage";
import { initTRPC, TRPCError } from "@trpc/server";

import type { ApiErrorCode } from "./errors";

/** The signed-in member, as resolved by the auth layer (cookie on web, Cookie header on Expo). */
export interface SessionUser {
  id: string;
  email: string;
}

/** The caller's account: role, suspension and blind listening, read from the profile once. */
export interface Account {
  user: SessionUser;
  role: "member" | "admin";
  suspendedAt: Date | null;
  suspensionReason: string | null;
  /** Read in the same query: blind listening shapes most pages (`viewerOf`). */
  blindMode: boolean;
  /** The whole profile row (null before onboarding), reused by `account.me`. */
  profile: ProfileRow | null;
}

export type ProfileRow = typeof schema.profiles.$inferSelect;

/** Request context; `now` is injectable so date-based logic stays testable. */
export interface Context {
  now: Date;
  /** Database, opened on first use: procedures that only read fixtures never connect. */
  db: () => Db;
  /**
   * The signed-in member, or null when signed out **or suspended**: a suspended account is a
   * visitor everywhere, except for the few `accountProcedure`s (memoised).
   */
  user: () => Promise<SessionUser | null>;
  /** The session's account, suspended or not (null when signed out). */
  account: () => Promise<Account | null>;
  /**
   * The raw session, suspended or not (null when signed out). Prefer `user()` / `account()`;
   * this only lets a loader start a query in parallel with the profile read.
   */
  session: () => Promise<SessionUser | null>;
  /**
   * Per-request memo: `memo(key, fn)` runs `fn` once per context and returns the same value
   * afterwards. Every mutation clears it (with `account` and `user`), so a read after a write
   * in the same request sees the new data.
   */
  memo: <T>(key: string, fn: () => T) => T;
  /** Clears the per-request memo (called after each mutation). */
  forget: () => void;
  /** Transactional emails (suspension notices), created on first use. */
  mailer: () => Mailer;
  /** Where members contest a moderation decision (shown in notices), if configured. */
  contactEmail: string | null;
  /** File storage (avatars), created on first use. */
  storage: () => Storage;
  /** Catalog provider (MusicBrainz behind the global gate), created on first use. */
  catalog: () => CatalogProvider;
}

export interface ContextOptions {
  db: () => Db;
  /** Session of the caller (cookie on web, Cookie header on Expo). */
  user?: () => Promise<SessionUser | null>;
  mailer?: () => Mailer;
  contactEmail?: string | null;
  storage?: () => Storage;
  catalog?: () => CatalogProvider;
  now?: Date;
}

const once = <T>(fn: () => T): (() => T) => {
  let value: { v: T } | undefined;
  return () => (value ??= { v: fn() }).v;
};

export function createContext(options: ContextOptions): Context {
  const store = new Map<string, unknown>();
  const memo = <T>(key: string, fn: () => T): T => {
    if (!store.has(key)) store.set(key, fn());
    return store.get(key) as T;
  };
  // The session itself never changes within a request: it survives `forget()`.
  const session = once(options.user ?? (async () => null));
  const account = () =>
    memo("account", async (): Promise<Account | null> => {
      const user = await session();
      if (!user) return null;
      const [row] = await options
        .db()
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, user.id));
      return {
        user,
        role: row?.role ?? "member",
        suspendedAt: row?.suspendedAt ?? null,
        suspensionReason: row?.suspensionReason ?? null,
        blindMode: row?.blindMode ?? false,
        profile: row ?? null,
      };
    });
  return {
    now: options.now ?? new Date(),
    db: options.db,
    account,
    session,
    memo,
    forget: () => store.clear(),
    user: async () => {
      const found = await account();
      return found && !found.suspendedAt ? found.user : null;
    },
    contactEmail: options.contactEmail ?? null,
    mailer: once(
      options.mailer ??
        (() => {
          throw new Error("No mailer configured for this context.");
        }),
    ),
    storage: once(
      options.storage ??
        (() => {
          throw new Error("No storage configured for this context.");
        }),
    ),
    catalog: once(
      options.catalog ??
        (() => {
          throw new Error("No catalog provider configured for this context.");
        }),
    ),
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
/** Base of every procedure: a mutation clears the per-request memo once it is done. */
export const publicProcedure = t.procedure.use(async ({ ctx, type, next }) => {
  const result = await next();
  if (type === "mutation") ctx.forget();
  return result;
});
export const createCallerFactory = t.createCallerFactory;

/** Throws a tRPC error whose message is a stable code the clients translate. */
export function fail(code: TRPCError["code"], message: ApiErrorCode): never {
  throw new TRPCError({ code, message });
}

/** Procedures for signed-in members: `ctx.user` is guaranteed (never a suspended account). */
export const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.user();
  if (!user) {
    if (await ctx.account()) fail("FORBIDDEN", "ACCOUNT_SUSPENDED");
    fail("UNAUTHORIZED", "UNAUTHENTICATED");
  }
  return next({ ctx: { ...ctx, user } });
});

/**
 * Procedures a suspended account may still use: reading its suspension, and its data rights
 * (export, deletion). `ctx.user` is the session's member, suspended or not.
 */
export const accountProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const account = await ctx.account();
  if (!account) fail("UNAUTHORIZED", "UNAUTHENTICATED");
  return next({ ctx: { ...ctx, user: account.user, account } });
});

/**
 * Admin procedures. The role is checked on the server for every call; it is granted only from
 * the command line (`pnpm admin:grant`). Anyone else gets NOT_FOUND, as if nothing were here.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const account = await ctx.account();
  if (account?.role !== "admin") fail("NOT_FOUND", "NOT_FOUND");
  return next({ ctx: { ...ctx, admin: ctx.user } });
});
