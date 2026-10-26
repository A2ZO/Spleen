import { eq, schema, seed, type DbHandle } from "@spleen/db";
import { fixtureId } from "@spleen/db/fixtures";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/*
 * The feed loaders batch their queries. These tests pin what they return on the demo seed
 * (a snapshot taken before the queries ran in parallel) and how many sequential round
 * trips a page costs, so a later change can make it faster without changing a byte.
 */

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");
const NUIT = { id: fixtureId(301), email: "nuitblanche@example.test" };
const SAM = { id: fixtureId(303), email: "rainydaysam@example.test" };
const VINCE_REVIEW = fixtureId(507);

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now });
}, 60_000);

afterAll(async () => {
  await handle.close();
});

const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));

const setBlind = (user: SessionUser, blindMode: boolean) =>
  handle.db.update(schema.profiles).set({ blindMode }).where(eq(schema.profiles.userId, user.id));

/** Every page of a cursor feed. */
async function allPages<T>(
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
) {
  const pages: T[][] = [];
  let cursor: string | undefined;
  do {
    const page = await load(cursor);
    pages.push(page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return pages;
}

/**
 * Measures sequential round trips (the longest chain of queries waiting on each other): a
 * query sent after another one answered comes one round trip later. Each answer is held for
 * a macrotask, so queries sent together always overlap. PGlite only.
 */
function trackRoundTrips(db: unknown) {
  const client = (db as { $client: { query: (...args: unknown[]) => Promise<unknown> } }).$client;
  const query = client.query.bind(client);
  let answered = 0;
  let roundTrips = 0;
  client.query = async (...args) => {
    const depth = answered + 1;
    roundTrips = Math.max(roundTrips, depth);
    const result = await query(...args);
    await new Promise((resolve) => setTimeout(resolve, 1));
    answered = Math.max(answered, depth);
    return result;
  };
  return {
    /** Round trips since the last call. */
    take: () => {
      const count = roundTrips;
      answered = roundTrips = 0;
      return count;
    },
    restore: () => (client.query = query),
  };
}

describe("feed loading", () => {
  it("returns the same pages as before", async () => {
    const result: Record<string, unknown> = {};
    for (const blind of [false, true]) {
      await setBlind(NUIT, blind);
      const nuit = api(NUIT);
      result[`friends nuit blind=${blind}`] = await allPages((cursor) =>
        nuit.feed.friends({ cursor }),
      );
      result[`popular fr nuit blind=${blind}`] = await allPages((cursor) =>
        nuit.feed.popular({ lang: "fr", cursor }),
      );
      result[`review nuit blind=${blind}`] = await nuit.review.byId({ id: VINCE_REVIEW });
    }
    await setBlind(NUIT, false);
    result["friends sam"] = await allPages((cursor) => api(SAM).feed.friends({ cursor }));
    result["popular en guest"] = await allPages((cursor) =>
      api(null).feed.popular({ lang: "en", cursor }),
    );
    expect(result).toMatchSnapshot();
  });

  it.skipIf(process.env.TEST_DATABASE_URL)("costs few sequential round trips", async () => {
    await setBlind(NUIT, true);
    const nuit = api(NUIT);
    const tracker = trackRoundTrips(handle.db);
    try {
      // Blind mode lookup, page query, then two for the cards: the rows (entries, reviews),
      // then everything they point to at once. A track's first release would add one.
      // Sequential loaders took 10, 6 and 8.
      await nuit.feed.friends({});
      expect(tracker.take()).toBe(4);
      await nuit.feed.popular({ lang: "fr" });
      expect(tracker.take()).toBe(4);
      await nuit.review.byId({ id: VINCE_REVIEW });
      expect(tracker.take()).toBe(4);
    } finally {
      tracker.restore();
      await setBlind(NUIT, false);
    }
  });
});
