import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanDemo, cleanDemoRefusal } from "./clean-demo";
import type { DbHandle } from "./client";
import { vitrineRefusal } from "./env";
import { eq, sql } from "./index";
import * as s from "./schema";
import { fixtureId } from "./seed/fixtures";
import { seed } from "./seed/seed";
import { slugify } from "./seed/slugify";
import { createTestDb } from "./testing";

const nocturnes = fixtureId(201);

let handle: DbHandle;
let member: string;
let imported: string;
let importedArtist: string;

const count = async (table: Parameters<DbHandle["db"]["$count"]>[0]) => handle.db.$count(table);

beforeEach(async () => {
  handle = await createTestDb();
  await seed(handle.db);
  // A real member and a record imported from MusicBrainz, which shares a seed genre.
  [{ id: member }] = (await handle.db
    .insert(s.user)
    .values({ name: "Membre", email: "membre@spleen.invalid", emailVerified: true })
    .returning({ id: s.user.id })) as [{ id: string }];
  [{ id: importedArtist }] = (await handle.db
    .insert(s.artists)
    .values({ slug: "e2e-band", name: "Vrai groupe", mbid: randomUUID() })
    .returning({ id: s.artists.id })) as [{ id: string }];
  [{ id: imported }] = (await handle.db
    .insert(s.releases)
    .values({ slug: "vrai-disque", title: "Vrai disque", type: "album", mbid: randomUUID() })
    .returning({ id: s.releases.id })) as [{ id: string }];
  await handle.db
    .insert(s.releaseArtists)
    .values({ releaseId: imported, artistId: importedArtist });
  const [jazz] = await handle.db
    .select({ id: s.genres.id })
    .from(s.genres)
    .where(eq(s.genres.slug, slugify("Jazz")));
  await handle.db.insert(s.releaseGenres).values({ releaseId: imported, genreId: jazz!.id });
  await handle.db.insert(s.entries).values({ userId: member, releaseId: imported, rating: 8 });
  // An e2e account and a throwaway record.
  await handle.db
    .insert(s.user)
    .values({ name: "", email: "e2e-abc1d@example.test", emailVerified: true });
  await handle.db
    .insert(s.releases)
    .values({ slug: "e2e-abc1d-1", title: "Jetable", type: "album" });
});

afterEach(async () => {
  await handle.close();
});

describe("db:clean-demo", () => {
  it("counts without deleting anything when not applied", async () => {
    const [users, releases] = [await count(s.user), await count(s.releases)];
    const result = await cleanDemo(handle.db, { apply: false });
    expect(result.applied).toBe(false);
    expect(result.realMemberRows).toBe(0);
    expect(result.deleted.user).toBe(users - 1);
    expect(result.deleted.releases).toBe(releases - 1);
    expect(result.deleted.entries).toBeGreaterThan(0);
    expect(await count(s.user)).toBe(users);
    expect(await count(s.releases)).toBe(releases);
  });

  it("keeps real members, imported records and the genres they use", async () => {
    await cleanDemo(handle.db, { apply: true });
    const users = await handle.db.select({ email: s.user.email }).from(s.user);
    expect(users).toEqual([{ email: "membre@spleen.invalid" }]);
    const releases = await handle.db.select({ id: s.releases.id }).from(s.releases);
    expect(releases).toEqual([{ id: imported }]);
    // An imported artist stays even with an `e2e-` slug: it has a MusicBrainz id.
    expect(await handle.db.select({ id: s.artists.id }).from(s.artists)).toEqual([
      { id: importedArtist },
    ]);
    expect(await count(s.tracks)).toBe(0);
    expect(await handle.db.select({ slug: s.genres.slug }).from(s.genres)).toEqual([
      { slug: slugify("Jazz") },
    ]);
    expect(await count(s.entries)).toBe(1);
    expect(await count(s.moods)).toBeGreaterThan(0);
    // Nothing left to do.
    expect((await cleanDemo(handle.db, { apply: true })).deleted).toEqual({});
  });

  it("refuses to apply while a real member has data on a fictional record", async () => {
    await handle.db
      .insert(s.favorites)
      .values({ userId: member, releaseId: nocturnes, position: 1 });
    expect((await cleanDemo(handle.db, { apply: false })).realMemberRows).toBe(1);
    await expect(cleanDemo(handle.db, { apply: true })).rejects.toThrow(/outside @example.test/);
    expect(await handle.db.$count(s.releases, sql`${s.releases.id} = ${nocturnes}`)).toBe(1);
  });

  it("with withMemberRows, deletes a real member's rows on fictional records, not the member", async () => {
    await handle.db
      .insert(s.favorites)
      .values({ userId: member, releaseId: nocturnes, position: 1 });
    await handle.db.insert(s.entries).values({ userId: member, releaseId: nocturnes, rating: 6 });
    const dry = await cleanDemo(handle.db, { apply: false, withMemberRows: true });
    expect(dry.realMemberRows).toBe(2);
    expect(dry.deleted.favorites).toBeGreaterThan(0);
    await cleanDemo(handle.db, { apply: true, withMemberRows: true });
    expect(await handle.db.$count(s.user)).toBe(1);
    // Only the entry on the imported record is left, and the stats will be recomputed.
    expect(await handle.db.select({ releaseId: s.entries.releaseId }).from(s.entries)).toEqual([
      { releaseId: imported },
    ]);
    expect(await handle.db.$count(s.userListeningVersion)).toBe(1);
  });
});

describe("vitrine guards", () => {
  const neon = (host: string) => `postgresql://u:p@${host}/neondb?sslmode=require`;
  const vitrine = "ep-vitrine-333333.eu-central-1.aws.neon.tech";
  const production = "ep-prod-222222.eu-central-1.aws.neon.tech";
  const env = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
    NODE_ENV: "development",
    NEON_MAIN_HOST: production,
    SPLEEN_VITRINE: "1",
    ...extra,
  });

  it("demo and e2e tasks refuse the vitrine, and only the vitrine", () => {
    expect(vitrineRefusal("db:seed", env())).toMatch(/db:seed refuses .*SPLEEN_VITRINE=1/);
    expect(vitrineRefusal("db:seed", env({ SPLEEN_VITRINE: undefined }))).toBeNull();
    expect(vitrineRefusal("db:seed", env({ SPLEEN_VITRINE: "" }))).toBeNull();
  });

  it("db:clean-demo runs only in the vitrine, never on production", () => {
    expect(cleanDemoRefusal(neon(vitrine), env())).toBeNull();
    expect(cleanDemoRefusal(neon(vitrine), env({ SPLEEN_VITRINE: undefined }))).toMatch(
      /only runs in the vitrine/,
    );
    expect(cleanDemoRefusal(neon(production), env())).toMatch(/production/);
    expect(cleanDemoRefusal(neon(vitrine), env({ NODE_ENV: "production" }))).toMatch(/production/);
    expect(cleanDemoRefusal(neon(vitrine), env({ NEON_MAIN_HOST: undefined }))).toMatch(
      /NEON_MAIN_HOST/,
    );
  });
});
