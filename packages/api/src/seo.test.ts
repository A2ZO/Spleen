import { randomUUID } from "node:crypto";

import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { REVIEW_INDEX_MIN_LENGTH } from "./lib/seo";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* What search engines may index (sitemap and robots meta) and which pages get an OG image. */

let handle: DbHandle;
const db = () => handle.db;
const short = () => randomUUID().slice(0, 8);
const api = (user: SessionUser | null = null) =>
  createCaller(createContext({ db: () => handle.db, user: async () => user }));

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

async function release(fields: Partial<typeof schema.releases.$inferInsert> = {}) {
  const slug = `release-${short()}`;
  const [row] = await db()
    .insert(schema.releases)
    .values({ slug, title: `Disque ${slug}`, type: "album", ...fields })
    .returning();
  return row!;
}

async function artist(releaseIds: string[]) {
  const slug = `artist-${short()}`;
  const [row] = await db().insert(schema.artists).values({ slug, name: slug }).returning();
  for (const releaseId of releaseIds) {
    await db().insert(schema.releaseArtists).values({ releaseId, artistId: row!.id });
  }
  return row!;
}

async function member(fields: Partial<typeof schema.profiles.$inferInsert> = {}) {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test` })
    .returning();
  await db()
    .insert(schema.profiles)
    .values({
      userId: row!.id,
      username,
      displayName: username,
      ageConfirmedAt: new Date(),
      ...fields,
    });
  return { id: row!.id, username };
}

const paths = async (kind: "releases" | "artists" | "lists" | "profiles" | "reviews") =>
  (await api().seo.sitemap({ kind, page: 1 })).map((e) => e.path);

describe("indexing", () => {
  it("lists complete releases, never stubs nor merged ones, and says so on the page", async () => {
    const [complete, manual, stub] = [
      await release({ mbid: randomUUID(), tracklistImportedAt: new Date() }),
      await release(),
      await release({ mbid: randomUUID() }),
    ];
    const merged = await release({ mergedIntoId: complete.id });
    const listed = await paths("releases");
    expect(listed).toEqual(
      expect.arrayContaining([`/album/${complete.slug}`, `/album/${manual.slug}`]),
    );
    expect(listed).not.toContain(`/album/${stub.slug}`);
    expect(listed).not.toContain(`/album/${merged.slug}`);
    expect(await api().seo.page({ kind: "release", key: stub.slug })).toMatchObject({
      indexable: false,
    });
    expect(await api().seo.page({ kind: "release", key: merged.slug })).toBeNull();
  });

  it("lists artists with at least one complete release", async () => {
    const withAlbum = await artist([(await release()).id]);
    const stubsOnly = await artist([(await release({ mbid: randomUUID() })).id]);
    const listed = await paths("artists");
    expect(listed).toContain(`/artist/${withAlbum.slug}`);
    expect(listed).not.toContain(`/artist/${stubsOnly.slug}`);
    expect(await api().seo.page({ kind: "artist", key: stubsOnly.slug })).toEqual({
      indexable: false,
      og: null,
    });
  });

  it("lists visible lists with items, by members who are not suspended", async () => {
    const owner = await member();
    const suspended = await member({ suspendedAt: new Date() });
    const record = await release();
    const [full, empty, hidden, banned] = await db()
      .insert(schema.lists)
      .values([
        { userId: owner.id, title: "Pleine" },
        { userId: owner.id, title: "Vide" },
        { userId: owner.id, title: "Masquée", hiddenAt: new Date(), hiddenBy: "moderation" },
        { userId: suspended.id, title: "Suspendue" },
      ])
      .returning();
    for (const list of [full!, hidden!, banned!]) {
      await db()
        .insert(schema.listItems)
        .values({ listId: list.id, releaseId: record.id, position: 1 });
    }
    const listed = await paths("lists");
    expect(listed).toContain(`/list/${full!.id}`);
    for (const list of [empty!, hidden!, banned!]) expect(listed).not.toContain(`/list/${list.id}`);
    expect(await api().seo.page({ kind: "list", key: empty!.id })).toMatchObject({
      indexable: false,
    });
    // Hidden or suspended: nothing for visitors, so no image either.
    expect(await api().seo.page({ kind: "list", key: hidden!.id })).toBeNull();
    expect(await api().seo.og({ kind: "list", key: banned!.id })).toBeNull();
    expect(await api().seo.og({ kind: "list", key: full!.id })).toMatchObject({
      kind: "list",
      title: "Pleine",
      items: 1,
    });
  });

  it("lists profiles with public activity; a private diary gets no image", async () => {
    const record = await release();
    const [reviewer, quiet, privateDiary, publicDiary] = [
      await member(),
      await member(),
      await member({ diaryPrivate: true }),
      await member(),
    ];
    const suspended = await member({ suspendedAt: new Date() });
    await db()
      .insert(schema.reviews)
      .values([
        { userId: reviewer.id, releaseId: record.id, body: "Superbe.", lang: "fr" },
        { userId: suspended.id, releaseId: record.id, body: "Spam.", lang: "fr" },
      ]);
    for (const m of [privateDiary, publicDiary]) {
      await db()
        .insert(schema.entries)
        .values({ userId: m.id, releaseId: record.id, listenedOn: "2026-10-01" });
    }
    const listed = await paths("profiles");
    expect(listed).toEqual(
      expect.arrayContaining([`/u/${reviewer.username}`, `/u/${publicDiary.username}`]),
    );
    for (const m of [quiet, privateDiary, suspended])
      expect(listed).not.toContain(`/u/${m.username}`);
    expect(await api().seo.page({ kind: "profile", key: privateDiary.username })).toEqual({
      indexable: false,
      og: null,
    });
    expect(await api().seo.page({ kind: "profile", key: suspended.username })).toBeNull();
  });

  it("gives album, artist and profile pages the same metadata as seo.page, signed in or not", async () => {
    const record = await release();
    const band = await artist([record.id]);
    const owner = await member();
    const viewer = await member();
    const signedIn: SessionUser = { id: viewer.id, email: `${viewer.username}@example.test` };
    for (const caller of [api(), api(signedIn)]) {
      expect((await caller.release.bySlug({ slug: record.slug }))?.seo).toEqual(
        await api().seo.page({ kind: "release", key: record.slug }),
      );
      expect((await caller.artist.bySlug({ slug: band.slug }))?.seo).toEqual(
        await api().seo.page({ kind: "artist", key: band.slug }),
      );
      expect((await caller.profile.byUsername({ username: owner.username }))?.seo).toEqual(
        await api().seo.page({ kind: "profile", key: owner.username }),
      );
    }
  });

  it("never shows a hidden review in an image, and changes the image URL with the review", async () => {
    const author = await member();
    const record = await release({
      coverUrl: "https://coverartarchive.org/release-group/x/front-500",
    });
    const [shown, hidden] = await db()
      .insert(schema.reviews)
      .values([
        {
          userId: author.id,
          releaseId: record.id,
          body: "Un  disque\nde nuit.",
          lang: "fr",
          rating: 8,
        },
        {
          userId: author.id,
          releaseId: record.id,
          body: "Masquée",
          lang: "fr",
          hiddenAt: new Date(),
          hiddenBy: "moderation",
        },
      ])
      .returning();
    expect(await api().seo.og({ kind: "review", key: hidden!.id })).toBeNull();
    const card = await api().seo.og({ kind: "review", key: shown!.id });
    expect(card).toMatchObject({
      title: record.title,
      author: author.username,
      rating: 8,
      excerpt: "Un disque de nuit.",
      covers: [record.coverUrl],
    });
    await db()
      .update(schema.reviews)
      .set({ body: "Réécrite.", updatedAt: new Date(Date.now() + 60_000) })
      .where(eq(schema.reviews.id, shown!.id));
    const after = await api().seo.page({ kind: "review", key: shown!.id });
    expect(after!.og).not.toBe(card!.version);
  });

  it("splits the sitemap into files, one at least per kind", async () => {
    expect(await api().seo.sitemapFiles()).toEqual({
      releases: 1,
      artists: 1,
      lists: 1,
      profiles: 1,
      reviews: 1,
    });
    expect(await api().seo.sitemap({ kind: "releases", page: 2 })).toEqual([]);
  });

  it(`indexes real reviews only: ${REVIEW_INDEX_MIN_LENGTH} characters of text or more`, async () => {
    const author = await member();
    const record = await release();
    const long = "Un disque de pluie fine, à écouter tard. ".repeat(5).trim();
    expect(long.length).toBeGreaterThanOrEqual(REVIEW_INDEX_MIN_LENGTH);
    const [real, short, padded] = await db()
      .insert(schema.reviews)
      .values([
        { userId: author.id, releaseId: record.id, body: long, lang: "fr" },
        { userId: author.id, releaseId: record.id, body: "Superbe !", lang: "fr" },
        // Spaces do not count.
        { userId: author.id, releaseId: record.id, body: `Bof.${" ".repeat(300)}`, lang: "fr" },
      ])
      .returning();
    const listed = await paths("reviews");
    expect(listed).toContain(`/review/${real!.id}`);
    for (const review of [short!, padded!]) {
      expect(listed).not.toContain(`/review/${review.id}`);
      // Thin, not hidden: the page stays shareable but says noindex.
      expect(await api().seo.page({ kind: "review", key: review.id })).toMatchObject({
        indexable: false,
        og: expect.any(String),
      });
    }
    expect(await api().seo.page({ kind: "review", key: real!.id })).toMatchObject({
      indexable: true,
    });
  });
});
