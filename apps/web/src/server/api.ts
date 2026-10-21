import "server-only";

import { createCaller, createContext } from "@spleen/api";
import { headers } from "next/headers";
import { cache } from "react";

import { sessionUserFrom } from "./auth";
import { getDb } from "./db";
import { getStorage } from "./storage";

/** tRPC context for a request: the session comes from its cookies (web) or Cookie header (Expo). */
export function contextFor(requestHeaders: Headers) {
  return createContext({
    db: getDb,
    user: () => sessionUserFrom(requestHeaders),
    storage: getStorage,
  });
}

/**
 * Server-side tRPC caller for React Server Components, Server Actions and route handlers.
 * One caller per request (React `cache`), so the context is shared within a render.
 */
export const getApi = cache(async () => createCaller(contextFor(await headers())));
