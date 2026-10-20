import "server-only";

import { createCaller, createContext } from "@spleen/api";
import { cache } from "react";

import { getDb } from "./db";

/**
 * Server-side tRPC caller for React Server Components.
 * One caller per request (React `cache`), so the context is shared within a render.
 */
export const getApi = cache(() => createCaller(createContext(getDb)));
