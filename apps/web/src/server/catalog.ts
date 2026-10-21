import "server-only";

import { createCatalogProvider } from "@spleen/api";
import type { CatalogProvider } from "@spleen/catalog";

import { getDb } from "./db";

const globalForCatalog = globalThis as typeof globalThis & { spleenCatalog?: CatalogProvider };

/** MusicBrainz behind the site-wide Postgres gate (1 request/s for every server instance). */
export function getCatalog(): CatalogProvider {
  globalForCatalog.spleenCatalog ??= createCatalogProvider(getDb());
  return globalForCatalog.spleenCatalog;
}
