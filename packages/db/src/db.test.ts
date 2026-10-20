import { readdirSync, readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDb, migrationDatabaseUrl, type DbHandle } from "./client";
import * as s from "./schema";
import { fixtureId } from "./seed/fixtures";
import { seed } from "./seed/seed";
import { slugify } from "./seed/slugify";

let handle: DbHandle;
const camille = fixtureId(301);
const vince = fixtureId(302);
const nocturnes = fixtureId(201);
const loneArtist = fixtureId(101);

/** Runs `fn` and returns the Postgres error message, failing if nothing was thrown. */
async function pgError(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const cause = (error as { cause?: { message?: string } }).cause;
    return cause?.message ?? (error as Error).message;
  }
  throw new Error("expected the statement to fail");
}

const count = async (table: Parameters<DbHandle["db"]["$count"]>[0]) => handle.db.$count(table);

beforeAll(async () => {
  handle = createDb("memory://");
  await handle.migrate();
  await seed(handle.db);
}, 60_000);

afterAll(async () => {
  await handle.close();
});

describe("migrations", () => {
  it("are in sync with the Drizzle schema", async () => {
    const metaDir = new URL("../migrations/meta/", import.meta.url);
    const latest = readdirSync(metaDir)
      .filter((f) => f.endsWith("_snapshot.json"))
      .sort()
      .at(-1);
    const prev = JSON.parse(readFileSync(new URL(latest!, metaDir), "utf8"));
    const statements = await generateMigration(prev, generateDrizzleJson(s));
    expect(statements, "run `pnpm db:generate`").toEqual([]);
  });
});

describe("seed", () => {
  it("loads the demo dataset", async () => {
    expect(await count(s.artists)).toBe(11);
    expect(await count(s.releases)).toBe(12);
    expect(await count(s.profiles)).toBe(3);
    expect(await count(s.entries)).toBe(19);
    expect(await count(s.favorites)).toBe(8);
  });

  it("is idempotent", async () => {
    const before = await Promise.all([count(s.tracks), count(s.userItemState), count(s.listItems)]);
    await seed(handle.db);
    const after = await Promise.all([count(s.tracks), count(s.userItemState), count(s.listItems)]);
    expect(after).toEqual(before);
  });
});

describe("constraints", () => {
  const entry = (extra: Partial<typeof s.entries.$inferInsert>) =>
    handle.db.insert(s.entries).values({ userId: camille, listenedOn: "2026-10-20", ...extra });

  it("requires exactly one target", async () => {
    expect(await pgError(() => entry({}))).toMatch(/entries_one_target/);
    expect(await pgError(() => entry({ releaseId: nocturnes, artistId: loneArtist }))).toMatch(
      /entries_one_target/,
    );
    await expect(entry({ artistId: loneArtist })).resolves.toBeDefined();
  });

  it("keeps ratings between 1 and 10", async () => {
    expect(await pgError(() => entry({ releaseId: nocturnes, rating: 0 }))).toMatch(/rating_range/);
    expect(await pgError(() => entry({ releaseId: nocturnes, rating: 11 }))).toMatch(
      /rating_range/,
    );
  });

  it("limits the Shelf to positions 1-4, once each", async () => {
    expect(
      await pgError(() =>
        handle.db.insert(s.favorites).values({ userId: vince, position: 5, releaseId: nocturnes }),
      ),
    ).toMatch(/favorites_position_range/);
    expect(
      await pgError(() =>
        handle.db.insert(s.favorites).values({ userId: vince, position: 1, releaseId: nocturnes }),
      ),
    ).toMatch(/duplicate key/);
  });

  it("makes usernames unique regardless of case", async () => {
    const [u] = await handle.db
      .insert(s.user)
      .values({ name: "Copycat", email: "copycat@example.test" })
      .returning({ id: s.user.id });
    expect(
      await pgError(() =>
        handle.db
          .insert(s.profiles)
          .values({ userId: u!.id, username: "NuitBlanche", displayName: "Copycat" }),
      ),
    ).toMatch(/profiles_username_lower_uidx/);
  });

  it("forbids following yourself", async () => {
    expect(
      await pgError(() =>
        handle.db.insert(s.follows).values({ followerId: camille, followeeId: camille }),
      ),
    ).toMatch(/follows_not_self/);
  });

  it("lets catalog additions have no subject, but nothing else", async () => {
    await expect(
      handle.db.insert(s.reports).values({ reporterId: camille, reason: "catalog_addition" }),
    ).resolves.toBeDefined();
    expect(
      await pgError(() =>
        handle.db.insert(s.reports).values({ reporterId: camille, reason: "spam" }),
      ),
    ).toMatch(/reports_one_subject/);
  });
});

describe("search", () => {
  const closest = async (query: string) => {
    const [row] = await handle.db
      .select({ title: s.releases.title })
      .from(s.releases)
      .orderBy(
        sql`similarity(lower(immutable_unaccent(${s.releases.title})), lower(immutable_unaccent(${query}))) desc`,
      )
      .limit(1);
    return row?.title;
  };

  it("ignores accents and case", async () => {
    expect(await closest("CAFE CREME")).toBe("Café crème");
  });

  it("tolerates typos", async () => {
    expect(await closest("nocturne pour pluie")).toBe("Nocturnes pour pluie fine");
    expect(await closest("smoke ring 1am")).toBe("Smoke Rings at 1 A.M.");
  });
});

describe("slugify", () => {
  it("builds URL slugs", () => {
    expect(slugify("Café crème")).toBe("cafe-creme");
    expect(slugify("Brass & Bone")).toBe("brass-and-bone");
    expect(slugify("  Le Roi d'un pays pluvieux ")).toBe("le-roi-d-un-pays-pluvieux");
  });
});

describe("migrationDatabaseUrl", () => {
  const pooled = "postgresql://u:p@ep-x-pooler.example.test/db";
  const direct = "postgresql://u:p@ep-x.example.test/db";

  it("uses the direct connection on Postgres", () => {
    expect(migrationDatabaseUrl({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct })).toBe(
      direct,
    );
  });

  it("refuses to migrate through the pooler", () => {
    expect(() => migrationDatabaseUrl({ DATABASE_URL: pooled })).toThrow(/DATABASE_URL_UNPOOLED/);
  });

  it("rejects a malformed URL without echoing it", () => {
    const failure = (url: string) => {
      try {
        createDb(url);
      } catch (error) {
        return (error as Error).message;
      }
      return "opened";
    };
    for (const url of ['"postgresql://u:secret@host/db"', "postgress://u:secret@host/db"]) {
      expect(failure(url)).toMatch(/must start with postgres:\/\//);
      expect(failure(url)).not.toMatch(/secret/);
    }
  });

  it("falls back to PGlite without DATABASE_URL", () => {
    expect(migrationDatabaseUrl({ DATABASE_URL_UNPOOLED: direct })).toBeUndefined();
    expect(migrationDatabaseUrl({ DATABASE_URL: "memory://" })).toBe("memory://");
  });
});
