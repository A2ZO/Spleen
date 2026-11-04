import { randomUUID } from "node:crypto";

import type { CatalogProvider } from "@spleen/catalog";
import { and, eq, recomputeItemState, schema, sql, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { importEntity } from "./lib/catalog/import";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

/* Duplicate merges and catalog reports, on an empty database. */

let handle: DbHandle;
const now = new Date("2026-10-26T12:00:00Z");
let admin: SessionUser;

const short = () => randomUUID().slice(0, 8);
const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));
const db = () => handle.db;

async function member(role: "member" | "admin" = "member"): Promise<SessionUser> {
  const username = `m${short()}`;
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `${username}@example.test`, emailVerified: true })
    .returning();
  await db().insert(schema.profiles).values({
    userId: row!.id,
    username,
    displayName: username,
    role,
    ageConfirmedAt: now,
  });
  return { id: row!.id, email: row!.email };
}

beforeAll(async () => {
  handle = await createTestDb();
  admin = await member("admin");
}, 60_000);

afterAll(async () => {
  await handle.close();
});

async function artist(fields: Partial<typeof schema.artists.$inferInsert> = {}) {
  const slug = `artist-${short()}`;
  const [row] = await db()
    .insert(schema.artists)
    .values({ slug, name: `Artist ${slug}`, ...fields })
    .returning();
  return row!;
}

async function release(fields: Partial<typeof schema.releases.$inferInsert> = {}) {
  const slug = `release-${short()}`;
  const [row] = await db()
    .insert(schema.releases)
    .values({ slug, title: `Release ${slug}`, type: "album", ...fields })
    .returning();
  return row!;
}

async function track(fields: Partial<typeof schema.tracks.$inferInsert> = {}) {
  const slug = `track-${short()}`;
  const [row] = await db()
    .insert(schema.tracks)
    .values({ slug, title: `Track ${slug}`, ...fields })
    .returning();
  return row!;
}

/** A listen, with the member's state derived from it as the API does. */
async function listen(
  user: SessionUser,
  target: { releaseId: string } | { trackId: string },
  options: { at?: Date; dated?: boolean; rating?: number; trackRatings?: [string, number][] } = {},
) {
  const at = options.at ?? now;
  const [entry] = await db()
    .insert(schema.entries)
    .values({
      userId: user.id,
      ...target,
      listenedOn: options.dated ? "2026-10-01" : null,
      rating: options.rating ?? null,
      createdAt: at,
      updatedAt: at,
    })
    .returning();
  for (const [trackId, rating] of options.trackRatings ?? []) {
    await db().insert(schema.trackRatings).values({ entryId: entry!.id, trackId, rating });
    await recomputeItemState(db(), user.id, { trackId });
  }
  await recomputeItemState(db(), user.id, target);
  return entry!;
}

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof TRPCError) return error.message;
    throw error;
  }
  throw new Error("expected an error");
}

const merge = (
  kind: "release" | "track" | "artist",
  keep: { slug: string },
  duplicate: { slug: string },
  reportId?: string,
) =>
  api(admin).admin.merge({
    kind,
    keep: keep.slug,
    duplicate: duplicate.slug,
    reason: "Même disque importé deux fois",
    reportId,
  });

describe("release merges", () => {
  it("move listens, states, reviews, lists and Shelves; the old page redirects", async () => {
    const [keep, dup] = [await release(), await release({ coverUrl: "https://cover.example/d" })];
    const [genre] = await db()
      .insert(schema.genres)
      .values({ slug: `g${short()}`, name: "jazz" })
      .returning();
    await db().insert(schema.releaseGenres).values({ releaseId: dup.id, genreId: genre!.id });
    const [a, b, reporter] = [await member(), await member(), await member()];

    // A rated both pages quickly; the duplicate's rating is the latest, it wins.
    await listen(a, { releaseId: keep.id }, { rating: 4, at: new Date(now.getTime() - 60_000) });
    const latest = await listen(a, { releaseId: dup.id }, { rating: 8 });
    await listen(
      a,
      { releaseId: dup.id },
      { dated: true, rating: 7, at: new Date(now.getTime() - 120_000) },
    );
    await db().insert(schema.reviews).values({
      userId: a.id,
      releaseId: dup.id,
      entryId: latest.id,
      body: "Un disque de nuit.",
      lang: "fr",
    });
    const [list] = await db()
      .insert(schema.lists)
      .values({ userId: a.id, title: "Nuit" })
      .returning();
    await db()
      .insert(schema.listItems)
      .values([
        { listId: list!.id, releaseId: keep.id, position: 1 },
        { listId: list!.id, releaseId: dup.id, position: 2 },
      ]);
    await db()
      .insert(schema.favorites)
      .values([
        { userId: a.id, position: 1, releaseId: keep.id },
        { userId: a.id, position: 2, releaseId: dup.id },
        { userId: b.id, position: 1, releaseId: dup.id },
      ]);
    // B only queued the duplicate.
    await db()
      .insert(schema.userItemState)
      .values({ userId: b.id, releaseId: dup.id, wantToListen: true });

    await api(reporter).report.catalog({
      target: { kind: "release", id: dup.id },
      type: "duplicate",
      duplicate: `https://spleen.example/fr/album/${keep.slug}`,
    });
    await api(b).report.catalog({
      target: { kind: "release", id: dup.id },
      type: "error",
      details: "Mauvaise date",
    });
    const queue = await api(admin).admin.reports({ kind: "catalog" });
    const suggested = queue.items.find((r) => r.reason === "catalog_duplicate")!;
    expect(suggested.subject.duplicate).toEqual({
      href: `/album/${keep.slug}`,
      label: keep.title,
      merge: { kind: "release", keep: keep.slug, duplicate: dup.slug },
    });
    expect(
      await api(admin).admin.mergePreview({
        kind: "release",
        keep: keep.slug,
        duplicate: dup.slug,
      }),
    ).toMatchObject({
      keep: { slug: keep.slug, listens: 1, reviews: 0, listItems: 1 },
      duplicate: { slug: dup.slug, listens: 2, reviews: 1, listItems: 1 },
    });

    expect(await merge("release", keep, dup, suggested.id)).toEqual({
      kind: "release",
      slug: keep.slug,
    });

    const onDup = async (
      table: typeof schema.entries | typeof schema.reviews | typeof schema.listItems,
    ) => db().$count(table, eq(table.releaseId, dup.id));
    expect([
      await onDup(schema.entries),
      await onDup(schema.reviews),
      await onDup(schema.listItems),
    ]).toEqual([0, 0, 0]);
    // One undated listen left for A (the latest), holding the review; the dated one moved.
    const aEntries = await db()
      .select({ id: schema.entries.id, listenedOn: schema.entries.listenedOn })
      .from(schema.entries)
      .where(eq(schema.entries.userId, a.id));
    expect(aEntries.filter((e) => e.listenedOn === null).map((e) => e.id)).toEqual([latest.id]);
    expect(aEntries).toHaveLength(2);
    const states = await db()
      .select({
        userId: schema.userItemState.userId,
        rating: schema.userItemState.rating,
        want: schema.userItemState.wantToListen,
      })
      .from(schema.userItemState)
      .where(eq(schema.userItemState.releaseId, keep.id));
    expect(states.sort((x, y) => x.userId.localeCompare(y.userId))).toEqual(
      [
        { userId: a.id, rating: 8, want: false },
        { userId: b.id, rating: null, want: true },
      ].sort((x, y) => x.userId.localeCompare(y.userId)),
    );
    expect(await db().$count(schema.listItems, eq(schema.listItems.listId, list!.id))).toBe(1);
    const shelves = await db()
      .select()
      .from(schema.favorites)
      .where(eq(schema.favorites.releaseId, keep.id));
    expect(shelves.map((f) => f.userId).sort()).toEqual([a.id, b.id].sort());

    // The page kept took what it lacked; the duplicate stays, pointing to it.
    const [kept] = await db().select().from(schema.releases).where(eq(schema.releases.id, keep.id));
    expect(kept!.coverUrl).toBe("https://cover.example/d");
    expect(
      await db().$count(schema.releaseGenres, eq(schema.releaseGenres.releaseId, keep.id)),
    ).toBe(1);
    const [old] = await db().select().from(schema.releases).where(eq(schema.releases.id, dup.id));
    expect(old!.mergedIntoId).toBe(keep.id);
    expect(await api(null).release.bySlug({ slug: dup.slug })).toBeNull();
    expect(await api(null).catalog.mergedInto({ kind: "release", slug: dup.slug })).toBe(keep.slug);
    expect(await api(null).catalog.mergedInto({ kind: "release", slug: keep.slug })).toBeNull();
    // What the page's layout checks before streaming (308, page, 404).
    const status = (slug: string) => api(null).catalog.pageStatus({ kind: "release", slug });
    expect(await status(dup.slug)).toEqual({ status: "merged", slug: keep.slug });
    expect(await status(keep.slug)).toEqual({ status: "found" });
    expect(await status("no-such-release")).toEqual({ status: "missing" });
    const page = await api(null).release.bySlug({ slug: keep.slug });
    expect(page).toMatchObject({ averageRating: 8, ratingCount: 1 });

    // The duplicate report is settled; the error report moved to the page kept.
    const reports = await db()
      .select({
        reason: schema.reports.reason,
        status: schema.reports.status,
        releaseId: schema.reports.releaseId,
      })
      .from(schema.reports)
      .where(sql`${schema.reports.releaseId} in (${keep.id}::uuid, ${dup.id}::uuid)`);
    expect(reports).toContainEqual({
      reason: "catalog_duplicate",
      status: "resolved",
      releaseId: dup.id,
    });
    expect(reports).toContainEqual({ reason: "catalog_error", status: "open", releaseId: keep.id });
    const [history] = (await api(admin).admin.history({})).items;
    expect(history).toMatchObject({
      action: "resolve",
      subject: "catalog",
      reason: "Même disque importé deux fois",
      reportReason: "catalog_duplicate",
    });

    expect(await errorCode(() => merge("release", keep, dup))).toBe("MERGE_ALREADY_MERGED");
    expect(await errorCode(() => merge("release", keep, keep))).toBe("MERGE_SAME");
  });

  it("re-point pages merged earlier into the duplicate (one step only)", async () => {
    const [first, second, third] = [await release(), await release(), await release()];
    await merge("release", second, third);
    await merge("release", first, second);
    expect(await api(null).catalog.mergedInto({ kind: "release", slug: third.slug })).toBe(
      first.slug,
    );
  });

  it("leave merged pages out of search and recent releases", async () => {
    const title = `Doublon ${short()}`;
    const [keep, dup] = [
      await release({ title, releaseDate: "2026-10-01", releaseDatePrecision: "day" }),
      await release({ title, releaseDate: "2026-10-01", releaseDatePrecision: "day" }),
    ];
    await merge("release", keep, dup);
    const found = await api(null).catalog.search({ q: title });
    expect(found.releases.map((r) => r.id)).toEqual([keep.id]);
    const recent = await api(null).discovery.recent({ page: 1 });
    expect(recent.items.map((r) => r.id)).not.toContain(dup.id);
  });

  it("roll everything back when a step fails", async () => {
    const [keep, dup] = [await release(), await release()];
    const a = await member();
    await listen(a, { releaseId: dup.id }, { rating: 6 });
    const decisions = await db().$count(schema.moderationActions);
    // Fails at the very last write, after every row has been moved.
    await db().execute(
      sql.raw(`create function fail_merge() returns trigger language plpgsql as $$
        begin raise exception 'merge failed on purpose'; end $$`),
    );
    await db().execute(
      sql.raw(`create trigger fail_merge before update of merged_into_id on releases
        for each row when (new.id = '${dup.id}') execute function fail_merge()`),
    );
    try {
      await expect(merge("release", keep, dup)).rejects.toThrow();
    } finally {
      await db().execute(sql.raw("drop trigger fail_merge on releases"));
      await db().execute(sql.raw("drop function fail_merge()"));
    }
    expect(await db().$count(schema.entries, eq(schema.entries.releaseId, dup.id))).toBe(1);
    expect(
      await db().$count(
        schema.userItemState,
        and(eq(schema.userItemState.releaseId, dup.id), eq(schema.userItemState.rating, 6)),
      ),
    ).toBe(1);
    const [old] = await db().select().from(schema.releases).where(eq(schema.releases.id, dup.id));
    expect(old!.mergedIntoId).toBeNull();
    expect(await db().$count(schema.moderationActions)).toBe(decisions);
  });
});

describe("track merges", () => {
  it("move listens, track ratings (one per album listen) and tracklists", async () => {
    const [keep, dup] = [await track(), await track({ durationMs: 300_000 })];
    const album = await release();
    await db()
      .insert(schema.releaseTracks)
      .values([
        { releaseId: album.id, trackId: keep.id, position: 1 },
        { releaseId: album.id, trackId: dup.id, position: 2 },
      ]);
    const a = await member();
    await listen(
      a,
      { releaseId: album.id },
      {
        trackRatings: [
          [keep.id, 4],
          [dup.id, 9],
        ],
      },
    );
    await listen(a, { trackId: dup.id }, { dated: true, rating: 10 });

    await merge("track", keep, dup);
    expect(await db().$count(schema.trackRatings, eq(schema.trackRatings.trackId, dup.id))).toBe(0);
    expect(await db().$count(schema.trackRatings, eq(schema.trackRatings.trackId, keep.id))).toBe(
      1,
    );
    expect(await db().$count(schema.entries, eq(schema.entries.trackId, keep.id))).toBe(1);
    expect(await db().$count(schema.releaseTracks, eq(schema.releaseTracks.trackId, dup.id))).toBe(
      0,
    );
    expect(await db().$count(schema.userItemState, eq(schema.userItemState.trackId, dup.id))).toBe(
      0,
    );
    const [state] = await db()
      .select({ listened: schema.userItemState.listened })
      .from(schema.userItemState)
      .where(eq(schema.userItemState.trackId, keep.id));
    expect(state!.listened).toBe(true);
    const [kept] = await db().select().from(schema.tracks).where(eq(schema.tracks.id, keep.id));
    expect(kept!.durationMs).toBe(300_000);
    expect(await api(null).track.bySlug({ slug: dup.slug })).toBeNull();
    expect(await api(null).catalog.mergedInto({ kind: "track", slug: dup.slug })).toBe(keep.slug);
  });
});

describe("artist merges", () => {
  it("move credits (one per record), list items and listens; the page kept fills its gaps", async () => {
    const [keep, dup] = [await artist(), await artist({ country: "FR" })];
    const [shared, own] = [await release(), await release()];
    await db()
      .insert(schema.releaseArtists)
      .values([
        { releaseId: shared.id, artistId: keep.id },
        { releaseId: shared.id, artistId: dup.id },
        { releaseId: own.id, artistId: dup.id },
      ]);
    const a = await member();
    const [list] = await db()
      .insert(schema.lists)
      .values({ userId: a.id, title: "Voix" })
      .returning();
    await db().insert(schema.listItems).values({ listId: list!.id, artistId: dup.id, position: 1 });

    await merge("artist", keep, dup);
    const credits = await db()
      .select({ releaseId: schema.releaseArtists.releaseId })
      .from(schema.releaseArtists)
      .where(eq(schema.releaseArtists.artistId, keep.id));
    expect(credits.map((c) => c.releaseId).sort()).toEqual([shared.id, own.id].sort());
    expect(
      await db().$count(schema.releaseArtists, eq(schema.releaseArtists.artistId, dup.id)),
    ).toBe(0);
    expect(await db().$count(schema.listItems, eq(schema.listItems.artistId, keep.id))).toBe(1);
    const [kept] = await db().select().from(schema.artists).where(eq(schema.artists.id, keep.id));
    expect(kept!.country).toBe("FR");
    const page = await api(null).artist.bySlug({ slug: keep.slug });
    expect(page!.discography.albums.map((r) => r.id).sort()).toEqual([shared.id, own.id].sort());
    expect(await api(null).artist.bySlug({ slug: dup.slug })).toBeNull();
  });
});

describe("imports after a merge", () => {
  const offline = new Proxy({} as CatalogProvider, {
    get: () => () => {
      throw new Error("the provider must not be called");
    },
  });

  it("follow the merge instead of bringing the duplicate back", async () => {
    const [keep, dup] = [await release(), await release({ mbid: randomUUID() })];
    const [keepArtist, dupArtist] = [await artist(), await artist({ mbid: randomUUID() })];
    const [keepTrack, dupTrack] = [await track(), await track({ mbid: randomUUID() })];
    await merge("release", keep, dup);
    await merge("artist", keepArtist, dupArtist);
    await merge("track", keepTrack, dupTrack);
    expect(await importEntity(db(), offline, "release_group", dup.mbid!)).toBe(keep.slug);
    expect(await importEntity(db(), offline, "artist", dupArtist.mbid!)).toBe(keepArtist.slug);
    expect(await importEntity(db(), offline, "recording", dupTrack.mbid!)).toBe(keepTrack.slug);
  });
});

describe("catalog reports", () => {
  it("record a type, and a duplicate names another page of the same kind", async () => {
    const [r, other] = [await release(), await release()];
    const someTrack = await track();
    const m = await member();
    const report = (
      type: "error" | "cover" | "duplicate" | "addition" | "other",
      duplicate?: string,
    ) =>
      api(m).report.catalog({
        target: { kind: "release", id: r.id },
        type,
        duplicate,
        details: "",
      });

    expect(await errorCode(() => report("duplicate", `/track/${someTrack.slug}`))).toBe(
      "DUPLICATE_NOT_FOUND",
    );
    expect(await errorCode(() => report("duplicate", "pas-une-fiche"))).toBe("DUPLICATE_NOT_FOUND");
    expect(await errorCode(() => report("duplicate", r.slug))).toBe("MERGE_SAME");
    await report("cover");
    await report("duplicate", `/en/album/${other.slug}`);
    const rows = await db()
      .select({ reason: schema.reports.reason, duplicate: schema.reports.duplicateReleaseId })
      .from(schema.reports)
      .where(eq(schema.reports.reporterId, m.id));
    // One open report per member and page: the second one adds nothing.
    expect(rows).toEqual([{ reason: "catalog_cover", duplicate: null }]);

    const n = await member();
    await api(n).report.catalog({
      target: { kind: "release", id: r.id },
      type: "duplicate",
      duplicate: other.slug,
    });
    expect(
      await db().$count(
        schema.reports,
        and(eq(schema.reports.reporterId, n.id), eq(schema.reports.duplicateReleaseId, other.id)),
      ),
    ).toBe(1);
    expect(
      await errorCode(() =>
        api(null).report.catalog({ target: { kind: "release", id: r.id }, type: "other" }),
      ),
    ).toBe("UNAUTHENTICATED");
  });

  it("are for admins only to merge", async () => {
    const m = await member();
    expect(
      await errorCode(() =>
        api(m).admin.merge({ kind: "release", keep: "a", duplicate: "b", reason: "Doublon" }),
      ),
    ).toBe("NOT_FOUND");
  });
});
