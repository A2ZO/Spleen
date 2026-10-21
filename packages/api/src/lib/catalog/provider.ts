import {
  CatalogError,
  createMusicBrainzProvider,
  isCatalogError,
  MUSICBRAINZ_INTERVAL_MS,
  sleep,
  type CatalogProvider,
  type Throttle,
} from "@spleen/catalog";
import type { Db } from "@spleen/db";
import { deferSlots, reserveSlot } from "@spleen/infra/rate-limit";

import { fail } from "../../trpc";

/** `rate_limits` key of the site-wide MusicBrainz gate. */
export const MUSICBRAINZ_GATE = "musicbrainz";

/**
 * The global 1 request/second MusicBrainz gate, shared by every server instance through
 * Postgres. A caller that would wait more than `maxWaitMs` gets a `busy` error instead.
 */
export function createPostgresThrottle(db: Db, maxWaitMs: number): Throttle {
  return {
    async acquire() {
      const wait = await reserveSlot(db, MUSICBRAINZ_GATE, {
        intervalMs: MUSICBRAINZ_INTERVAL_MS,
        maxWaitMs,
      });
      if (wait === null) throw new CatalogError("busy", "MusicBrainz queue is full.");
      await sleep(wait);
    },
    backOff: (seconds) => deferSlots(db, MUSICBRAINZ_GATE, seconds),
  };
}

export interface CatalogProviderOptions {
  /** How long a request may wait for its slot: short for pages, long for scripts. */
  maxWaitMs?: number;
  userAgent?: string;
}

/** MusicBrainz behind the Postgres gate. Throws a CatalogError when the User-Agent is missing. */
export function createCatalogProvider(
  db: Db,
  options: CatalogProviderOptions = {},
): CatalogProvider {
  return createMusicBrainzProvider({
    userAgent: options.userAgent ?? process.env.MUSICBRAINZ_USER_AGENT,
    throttle: createPostgresThrottle(db, options.maxWaitMs ?? 8000),
  });
}

/** Runs a provider call, turning catalog errors into stable API error codes. */
export async function withCatalogErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isCatalogError(error)) throw error;
    if (error.kind === "busy") fail("TOO_MANY_REQUESTS", "CATALOG_BUSY");
    if (error.kind === "not_found") fail("NOT_FOUND", "CATALOG_NOT_FOUND");
    fail("SERVICE_UNAVAILABLE", "CATALOG_UNAVAILABLE");
  }
}

/** Best-effort provider call (completing a page): catalog errors leave the page as it is. */
export async function tryCatalog(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!isCatalogError(error)) throw error;
  }
}
