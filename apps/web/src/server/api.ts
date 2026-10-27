import "server-only";

import { createCaller, createContext } from "@spleen/api";
import { contactEmail } from "@spleen/infra/config";
import { headers } from "next/headers";
import { cache } from "react";

import { sessionUserFrom } from "./auth";
import { getCatalog } from "./catalog";
import { getDb } from "./db";
import { getMailer } from "./mailer";
import { getStorage } from "./storage";

/** tRPC context for a request: the session comes from its cookies (web) or Cookie header (Expo). */
export function contextFor(requestHeaders: Headers) {
  return createContext({
    db: getDb,
    user: () => sessionUserFrom(requestHeaders),
    storage: getStorage,
    catalog: getCatalog,
    mailer: getMailer,
    contactEmail: contactEmail(),
  });
}

/**
 * Server-side tRPC caller for React Server Components, Server Actions and route handlers.
 * One caller per request (React `cache`), so the context is shared within a render.
 */
export const getApi = cache(async () => createCaller(contextFor(await headers())));

/**
 * A caller without any session, for what is cached and shared with everyone (sitemaps, Open
 * Graph images, search metadata): its answer never depends on who asked, so an author's view
 * of their hidden content can never end up in a public cache.
 */
export const getPublicApi = cache(() =>
  createCaller(createContext({ db: getDb, catalog: getCatalog, contactEmail: contactEmail() })),
);
