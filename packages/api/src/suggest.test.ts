import { eq, schema, seed, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { highlightParts } from "./highlight";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* Instant search rules (docs/catalogue.md, "Recherche"). */

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db);
  const db = handle.db;
  const releases = await db
    .insert(schema.releases)
    .values([
      { slug: "zinzolin-nord", title: "Zinzolin Nord", type: "album" },
      { slug: "zinzolin-sud", title: "Zinzolin Sud", type: "album" },
      { slug: "le-grand-zinzolin", title: "Le grand zinzolin", type: "album" },
      ...[1, 2, 3, 4, 5, 6].map((n) => ({
        slug: `quokka-${n}`,
        title: `Quokka ${n}`,
        type: "single" as const,
      })),
    ])
    .returning();
  const bySlug = new Map(releases.map((r) => [r.slug, r.id]));
  const listeners = await db
    .insert(schema.user)
    .values([1, 2, 3].map((n) => ({ name: "", email: `zz${n}@example.test`, emailVerified: true })))
    .returning();
  // "Le grand zinzolin": 3 listeners, "Zinzolin Sud": 2, "Zinzolin Nord": none.
  await db.insert(schema.userItemState).values([
    ...listeners.map((u) => ({
      userId: u.id,
      releaseId: bySlug.get("le-grand-zinzolin")!,
      listened: true,
    })),
    ...listeners
      .slice(0, 2)
      .map((u) => ({ userId: u.id, releaseId: bySlug.get("zinzolin-sud")!, listened: true })),
    // Wanting to listen is not listening.
    { userId: listeners[2]!.id, releaseId: bySlug.get("zinzolin-nord")!, wantToListen: true },
  ]);
}, 60_000);

afterAll(() => handle.close());

const neverCatalog = () => {
  throw new Error("the instant search must never call the catalog provider");
};

function api(user: SessionUser | null = null) {
  return createCaller(
    createContext({ db: () => handle.db, user: async () => user, catalog: neverCatalog }),
  );
}

const suggest = (q: string, user: SessionUser | null = null) => api(user).catalog.suggest({ q });

describe("catalog.suggest", () => {
  it("puts what starts with the query first, then popularity, then similarity", async () => {
    const result = await suggest("zinzolin");
    // Sud and Nord both start with it; Sud has more listeners. The more popular
    // "Le grand zinzolin" only contains it.
    expect(result.best?.slug).toBe("zinzolin-sud");
    expect(result.releases.map((r) => r.slug)).toEqual(["zinzolin-nord", "le-grand-zinzolin"]);
    // The full search page follows the same order.
    const page = await api().catalog.search({ q: "zinzolin", type: "release" });
    expect(page.releases.map((r) => r.slug)).toEqual([
      "zinzolin-sud",
      "zinzolin-nord",
      "le-grand-zinzolin",
    ]);
  });

  it("shows a best result and at most three per kind", async () => {
    const result = await suggest("quokka");
    expect(result.best?.kind).toBe("release");
    expect(result.releases).toHaveLength(3);
    expect(result.releases.map((r) => r.slug)).not.toContain(result.best?.slug);
    const seeded = await suggest("lune basse");
    expect(seeded.best).toMatchObject({ kind: "artist", slug: "lune-basse" });
    for (const group of [seeded.artists, seeded.releases, seeded.tracks]) {
      expect(group.length).toBeLessThanOrEqual(3);
    }
    expect(seeded.releases[0]).toMatchObject({ subtitle: "Lune Basse", releaseType: "album" });
    expect(seeded.releases[0]?.cover?.slug).toBe(seeded.releases[0]?.slug);
  });

  it("looks for members only after an @, suspended members left out", async () => {
    const members = await suggest("@nuit");
    expect(members.members.map((m) => m.username)).toContain("nuitblanche");
    expect(members.members[0]).toEqual({
      username: "nuitblanche",
      displayName: expect.any(String),
      avatarUrl: null,
    });
    expect([members.best, ...members.artists, ...members.releases, ...members.tracks]).toEqual([
      null,
    ]);
    expect((await suggest("nuitblanche")).members).toEqual([]);

    await handle.db
      .update(schema.profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(schema.profiles.username, "vinylvince"));
    expect((await suggest("@vinyl")).members).toEqual([]);
  });

  it("needs 2 to 100 characters, normalised", async () => {
    await expect(suggest("z")).rejects.toThrow();
    await expect(suggest("  z  ")).rejects.toThrow();
    await expect(suggest("z".repeat(101))).rejects.toThrow();
    expect(await suggest("  ZINZOLIN   Nord ")).toEqual(await suggest("zinzolin nord"));
  });

  it("holds nothing personal: the same answer for everyone", async () => {
    const [row] = await handle.db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.email, "nuitblanche@example.test"));
    await handle.db
      .update(schema.profiles)
      .set({ blindMode: true })
      .where(eq(schema.profiles.userId, row!.id));
    const anonymous = await suggest("nocturnes");
    expect(await suggest("nocturnes", row!)).toEqual(anonymous);
    const keys = JSON.stringify(anonymous).match(/"(\w+)":/g) ?? [];
    expect(new Set(keys)).toEqual(
      new Set(
        [
          "best",
          "artists",
          "releases",
          "tracks",
          "members",
          "kind",
          "slug",
          "title",
          "subtitle",
          "cover",
          "url",
          "year",
          "releaseType",
        ].map((k) => `"${k}":`),
      ),
    );
  });
});

describe("highlightParts", () => {
  it("bolds what matches, accents and case aside", () => {
    expect(highlightParts("Béton velours", "beton")).toEqual([
      { text: "Béton", match: true },
      { text: " velours", match: false },
    ]);
    expect(highlightParts("Le grand zinzolin", "ZIN grand")).toEqual([
      { text: "Le ", match: false },
      { text: "grand", match: true },
      { text: " ", match: false },
      { text: "zin", match: true },
      { text: "zolin", match: false },
    ]);
    expect(highlightParts("nuitblanche", "@nuit")[0]).toEqual({ text: "nuit", match: true });
    expect(highlightParts("Café", "xyz")).toEqual([{ text: "Café", match: false }]);
  });
});
