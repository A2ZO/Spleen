import { readdirSync, readFileSync } from "node:fs";

import { sql } from "drizzle-orm";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setAdminRole } from "./admin";
import { createDb, migrationDatabaseUrl, type DbHandle } from "./client";
import {
  deleteE2eAccounts,
  freesUsernamesAtOnce,
  isE2eEmail,
  neonEndpointId,
  unsafeE2eDatabase,
} from "./e2e";
import * as s from "./schema";
import { fixtureId } from "./seed/fixtures";
import { seed } from "./seed/seed";
import { slugify } from "./seed/slugify";
import { TERMS_VERSION } from "@spleen/validators";

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
    expect(await count(s.artists)).toBe(12);
    expect(await count(s.releases)).toBe(45);
    expect(await count(s.profiles)).toBe(11);
    expect(await count(s.entries)).toBe(73);
    expect(await count(s.favorites)).toBe(12);
    expect(await count(s.follows)).toBe(7);
    expect(await count(s.likes)).toBe(19);
    expect(await count(s.comments)).toBe(12);
    expect(await count(s.blocks)).toBe(1);
    expect(await count(s.lists)).toBe(6);
    expect(await count(s.listItems)).toBe(25);
    expect(await count(s.reports)).toBe(7);
    expect(await count(s.moderationActions)).toBe(1);
  });

  it("is idempotent", async () => {
    const tables = [
      s.tracks,
      s.userItemState,
      s.listItems,
      s.notifications,
      s.reports,
      s.moderationActions,
    ] as const;
    const before = await Promise.all(tables.map((t) => count(t)));
    await seed(handle.db);
    const after = await Promise.all(tables.map((t) => count(t)));
    expect(after).toEqual(before);
  });

  it("moves demo profiles to the current terms, whatever they accepted before", async () => {
    await handle.db.update(s.profiles).set({ termsVersion: null, termsAcceptedAt: null });
    await handle.db
      .update(s.profiles)
      .set({ termsVersion: "1999-01-01" })
      .where(sql`${s.profiles.userId} = ${camille}`);
    await seed(handle.db);
    const versions = await handle.db
      .selectDistinct({ version: s.profiles.termsVersion })
      .from(s.profiles);
    expect(versions).toEqual([{ version: TERMS_VERSION }]);
  });
});

describe("seeded member state", () => {
  const stateOf = async (userId: string, releaseId: string) => {
    const [row] = await handle.db
      .select()
      .from(s.userItemState)
      .where(
        sql`${s.userItemState.userId} = ${userId} and ${s.userItemState.releaseId} = ${releaseId}`,
      );
    return row;
  };

  it("takes the rating of the most recently edited listen, undated ones included", async () => {
    // Camille: dated 3/5 in August, then a quick 3.5/5 (undated, edited later).
    expect((await stateOf(camille, fixtureId(210)))?.rating).toBe(7);
    // Vince only rated it quickly, without a date.
    expect(await stateOf(vince, nocturnes)).toMatchObject({ rating: 8, listened: true });
  });

  it("derives track states from track-by-track ratings", async () => {
    const rows = await handle.db
      .select()
      .from(s.userItemState)
      .where(
        sql`${s.userItemState.userId} = ${camille} and ${s.userItemState.trackId} is not null`,
      );
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.listened && !r.liked)).toBe(true);
  });

  it("keeps the 'to listen' queue", async () => {
    const sam = fixtureId(303);
    expect(await stateOf(sam, nocturnes)).toMatchObject({ wantToListen: true, listened: false });
  });

  it("allows one undated listen per member and target", async () => {
    const insert = () =>
      handle.db.insert(s.entries).values({ userId: vince, releaseId: nocturnes, listenedOn: null });
    expect(await pgError(insert)).toMatch(/entries_undated_release_uidx/);
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

describe("e2e accounts", () => {
  it("are recognised by their exact email shape only", () => {
    expect(isE2eEmail("e2e-mvnyb1x2d@example.test")).toBe(true);
    expect(isE2eEmail("nuitblanche@example.test")).toBe(false);
    expect(isE2eEmail("e2e-someone@gmail.com")).toBe(false);
  });

  it("free their usernames at once in development and tests only", () => {
    const email = "e2e-mvnyb1x2d@example.test";
    expect(freesUsernamesAtOnce(email, { NODE_ENV: "development" })).toBe(true);
    expect(freesUsernamesAtOnce(email, { NODE_ENV: "test" })).toBe(true);
    expect(freesUsernamesAtOnce(email, { NODE_ENV: "production" })).toBe(false);
    expect(freesUsernamesAtOnce(email, {})).toBe(false);
    expect(freesUsernamesAtOnce("nuitblanche@example.test", { NODE_ENV: "test" })).toBe(false);
  });

  it("are deleted with their data and username reservations, nobody else", async () => {
    const [e2e] = await handle.db
      .insert(s.user)
      .values({ name: "", email: "e2e-abc1d@example.test", emailVerified: true })
      .returning();
    await handle.db.insert(s.profiles).values({
      userId: e2e!.id,
      username: "e2e_abc1d",
      displayName: "Alice Nocturne",
      ageConfirmedAt: new Date(),
    });
    await handle.db.insert(s.follows).values({ followerId: e2e!.id, followeeId: vince });
    await handle.db.insert(s.usernameHistory).values({ userId: null, username: "e2e_old1m" });
    const [users, profiles] = [await count(s.user), await count(s.profiles)];

    expect(await deleteE2eAccounts(handle.db)).toBe(1);
    expect(await count(s.user)).toBe(users - 1);
    expect(await count(s.profiles)).toBe(profiles - 1);
    expect(await handle.db.$count(s.follows, sql`${s.follows.followerId} = ${e2e!.id}`)).toBe(0);
    expect(
      await handle.db.$count(s.usernameHistory, sql`${s.usernameHistory.username} like 'e2e_%'`),
    ).toBe(0);
    expect(await handle.db.$count(s.user, sql`${s.user.id} = ${camille}`)).toBe(1);
  });

  it("take their reports, decisions and throwaway releases along, merged ones first", async () => {
    const [e2e] = await handle.db
      .insert(s.user)
      .values({ name: "", email: "e2e-rep1d@example.test", emailVerified: true })
      .returning();
    const [kept, merged, imported] = await handle.db
      .insert(s.releases)
      .values([
        { slug: "e2e-rep1d-a", title: "Disque jetable", type: "album" },
        { slug: "e2e-rep1d-b", title: "Disque jetable", type: "album" },
        // Looks like a throwaway slug but comes from MusicBrainz: never deleted.
        { slug: "e2e-rep1d-c", title: "Importé", type: "album", mbid: crypto.randomUUID() },
      ])
      .returning();
    await handle.db
      .update(s.releases)
      .set({ mergedIntoId: kept!.id })
      .where(sql`${s.releases.id} = ${merged!.id}`);
    const [report] = await handle.db
      .insert(s.reports)
      .values([
        {
          reporterId: e2e!.id,
          releaseId: merged!.id,
          duplicateReleaseId: kept!.id,
          reason: "catalog_duplicate",
        },
        // Left by an e2e account already deleted: still found through the release.
        { reporterId: null, releaseId: kept!.id, reason: "catalog_cover" },
        // A member's report on a demo record stays.
        { reporterId: vince, reviewId: null, releaseId: imported!.id, reason: "catalog_error" },
      ])
      .returning();
    await handle.db.insert(s.moderationActions).values({
      action: "resolve",
      subject: "catalog",
      reason: "Doublon",
      moderatorId: e2e!.id,
      reportId: report!.id,
    });
    const [reports, actions] = [await count(s.reports), await count(s.moderationActions)];

    await deleteE2eAccounts(handle.db);
    expect(await count(s.reports)).toBe(reports - 2);
    expect(await count(s.moderationActions)).toBe(actions - 1);
    const left = await handle.db
      .select({ slug: s.releases.slug })
      .from(s.releases)
      .where(sql`${s.releases.slug} like 'e2e-%'`);
    expect(left).toEqual([{ slug: "e2e-rep1d-c" }]);
  });
});

describe("e2e cleanup guard", () => {
  const neon = (host: string) => `postgresql://u:p@${host}/neondb?sslmode=require`;
  const dev = "ep-dev-111111.eu-central-1.aws.neon.tech";
  const production = "ep-prod-222222.eu-central-1.aws.neon.tech";
  const productionPooled = "ep-prod-222222-pooler.eu-central-1.aws.neon.tech";
  const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    NODE_ENV: "test",
    NEON_MAIN_HOST: production,
    ...extra,
  });

  it("allows a local Postgres and Neon's dev branch", () => {
    expect(unsafeE2eDatabase("postgres://u:p@localhost:5432/spleen", env())).toBeNull();
    expect(unsafeE2eDatabase(neon(dev), env())).toBeNull();
    expect(unsafeE2eDatabase(neon(dev.replace("111111", "111111-pooler")), env())).toBeNull();
  });

  it("refuses production, even on a local database", () => {
    const local = "postgres://u:p@localhost:5432/spleen";
    expect(unsafeE2eDatabase(local, env({ NODE_ENV: "production" }))).toMatch(/production/);
  });

  it("refuses Neon's production branch, through its direct or pooled host", () => {
    expect(unsafeE2eDatabase(neon(production), env())).toMatch(/production/);
    expect(unsafeE2eDatabase(neon(productionPooled), env())).toMatch(/production/);
    // NEON_MAIN_HOST may be the pooled host or the bare endpoint id.
    expect(unsafeE2eDatabase(neon(production), env({ NEON_MAIN_HOST: productionPooled }))).toMatch(
      /production/,
    );
    expect(
      unsafeE2eDatabase(neon(productionPooled), env({ NEON_MAIN_HOST: "ep-prod-222222" })),
    ).toMatch(/production/);
  });

  it("refuses every Neon database while NEON_MAIN_HOST is missing or invalid", () => {
    expect(unsafeE2eDatabase(neon(dev), env({ NEON_MAIN_HOST: undefined }))).toMatch(
      /NEON_MAIN_HOST/,
    );
    expect(unsafeE2eDatabase(neon(dev), env({ NEON_MAIN_HOST: " " }))).toMatch(/NEON_MAIN_HOST/);
    expect(unsafeE2eDatabase(neon(dev), env({ NEON_MAIN_HOST: "localhost" }))).toMatch(
      /NEON_MAIN_HOST/,
    );
  });

  it("reads the endpoint id from a host or a URL", () => {
    expect(neonEndpointId(productionPooled)).toBe("ep-prod-222222");
    expect(neonEndpointId(neon(production))).toBe("ep-prod-222222");
    expect(neonEndpointId("localhost")).toBeNull();
  });
});

describe("slugify", () => {
  it("builds URL slugs", () => {
    expect(slugify("Café crème")).toBe("cafe-creme");
    expect(slugify("Brass & Bone")).toBe("brass-and-bone");
    expect(slugify("Mauvais œil")).toBe("mauvais-oeil");
    expect(slugify("Ørsted Æther Straße")).toBe("orsted-aether-strasse");
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

describe("admin role (command line only)", () => {
  const roleOf = async (userId: string) =>
    (
      await handle.db
        .select({ role: s.profiles.role })
        .from(s.profiles)
        .where(sql`${s.profiles.userId} = ${userId}`)
    )[0]?.role;

  it("grants and revokes the role by email, case-insensitive", async () => {
    const vince = fixtureId(302);
    expect(await setAdminRole(handle.db, " VinylVince@Example.test ", true)).toBe("granted");
    expect(await roleOf(vince)).toBe("admin");
    expect(await setAdminRole(handle.db, "vinylvince@example.test", true)).toBe("unchanged");
    expect(await setAdminRole(handle.db, "vinylvince@example.test", false)).toBe("revoked");
    expect(await roleOf(vince)).toBe("member");
  });

  it("refuses an unknown email and an account without a profile", async () => {
    expect(await setAdminRole(handle.db, "nobody@example.test", true)).toBe("no-account");
    const id = fixtureId(44_999);
    await handle.db
      .insert(s.user)
      .values({ id, name: "Sans profil", email: "sans-profil@example.test", emailVerified: true });
    expect(await setAdminRole(handle.db, "sans-profil@example.test", true)).toBe("no-profile");
  });

  it("seeds a demo admin", async () => {
    expect(await roleOf(fixtureId(44_000))).toBe("admin");
  });
});
