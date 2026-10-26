import {
  isCatalogError,
  isMainRelease,
  rankEditions,
  type ArtistCredit,
  type CatalogProvider,
  type ProviderArtist,
  type ProviderRecording,
  type ReleaseGroupDetail,
  type ReleaseGroupSummary,
  type Tracklist,
} from "@spleen/catalog";
import { and, eq, inArray, schema, slugify, sql, type Db } from "@spleen/db";
import type { ImportKind } from "@spleen/validators";

/*
 * On-demand import from the catalog provider (MusicBrainz), once and for all: the provider id
 * (`mbid`) is the uniqueness key, so every import is an idempotent upsert. Slugs are chosen
 * once and never change (stable URLs). Flow and rules: docs/catalogue.md.
 */

const { artists, catalogImportJobs, genres, releaseArtists, releaseGenres, releases } = schema;
const { releaseTracks, trackArtists, tracks } = schema;

/** Editions tried for the tracklist when MusicBrainz cannot serve the reference one. */
const EDITION_TRIES = 2;
/** Cover lookups during a discography import (Cover Art Archive, not rate limited). */
const COVER_CONCURRENCY = 8;
const MAX_DISCOGRAPHY_COVERS = 100;
const MAX_SLUG_LENGTH = 120;

export interface ImportOptions {
  requestedById?: string | null;
  now?: Date;
}

/* ---------------------------------------------------------------- slugs */

const clean = (value: string) => slugify(value).slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");

/**
 * First free slug among the candidates (words that make it more specific: artist, year…),
 * then the first one with a number. Titles without Latin letters fall back to `fallback`.
 */
async function freeSlug(
  isTaken: (slug: string) => Promise<boolean>,
  candidates: (string | null | undefined)[],
  fallback: string,
): Promise<string> {
  const options = [...new Set(candidates.filter((c): c is string => !!c).map(clean))].filter(
    Boolean,
  );
  if (options.length === 0) options.push(clean(fallback));
  for (const option of options) if (!(await isTaken(option))) return option;
  for (let n = 2; ; n++) {
    const numbered = `${options[0]}-${n}`;
    if (!(await isTaken(numbered))) return numbered;
  }
}

const slugTaken =
  (db: Db, table: typeof artists | typeof releases | typeof tracks) => async (slug: string) =>
    (await db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).limit(1)).length > 0;

/**
 * Slug check for many rows at once: the candidates are looked up in one query, and every
 * slug handed out is remembered so two new rows never get the same one.
 */
async function batchSlugCheck(
  db: Db,
  table: typeof releases,
  candidates: string[],
): Promise<(slug: string) => Promise<boolean>> {
  const checked = new Set(candidates);
  const taken = new Set(
    candidates.length === 0
      ? []
      : (
          await db
            .select({ slug: table.slug })
            .from(table)
            .where(inArray(table.slug, [...checked]))
        ).map((r) => r.slug),
  );
  const inDb = slugTaken(db, table);
  return async (slug) => {
    const result = taken.has(slug) || (!checked.has(slug) && (await inDb(slug)));
    if (!result) taken.add(slug); // freeSlug uses the first free slug it is told about.
    return result;
  };
}

/* ---------------------------------------------------------------- jobs */

async function startJob(db: Db, kind: ImportKind, mbid: string, options: ImportOptions) {
  await db
    .insert(catalogImportJobs)
    .values({ kind, mbid, status: "running", attempts: 1, requestedById: options.requestedById })
    .onConflictDoUpdate({
      target: [catalogImportJobs.kind, catalogImportJobs.mbid],
      set: {
        status: "running",
        attempts: sql`${catalogImportJobs.attempts} + 1`,
        lastError: null,
        updatedAt: new Date(),
      },
    });
}

async function finishJob(db: Db, kind: ImportKind, mbid: string, error?: unknown) {
  await db
    .update(catalogImportJobs)
    .set({
      status: error ? "failed" : "done",
      // Provider errors carry no secret; anything else is reduced to its type.
      lastError: error
        ? isCatalogError(error)
          ? `${error.kind}: ${error.message}`.slice(0, 500)
          : error instanceof Error
            ? error.name
            : "error"
        : null,
      updatedAt: new Date(),
    })
    .where(and(eq(catalogImportJobs.kind, kind), eq(catalogImportJobs.mbid, mbid)));
}

async function tracked<T>(
  db: Db,
  kind: ImportKind,
  mbid: string,
  options: ImportOptions,
  run: () => Promise<T>,
): Promise<T> {
  await startJob(db, kind, mbid, options);
  try {
    const result = await run();
    await finishJob(db, kind, mbid);
    return result;
  } catch (error) {
    await finishJob(db, kind, mbid, error);
    throw error;
  }
}

/* ---------------------------------------------------------------- writers */

type ArtistCache = Map<string, { id: string; slug: string; name: string }>;

/**
 * A row merged into another one stands for the row kept (one step: merges never chain), so an
 * import never brings a duplicate back.
 */
async function followMerge(
  db: Db,
  table: typeof artists | typeof releases | typeof tracks,
  row: { id: string; slug: string; mergedIntoId: string | null },
): Promise<{ id: string; slug: string }> {
  if (!row.mergedIntoId) return row;
  const [kept] = await db
    .select({ id: table.id, slug: table.slug })
    .from(table as typeof releases)
    .where(eq(table.id, row.mergedIntoId));
  return kept!;
}

/** Inserts or refreshes an artist by provider id; keeps its slug once chosen. */
async function upsertArtist(db: Db, artist: ProviderArtist, cache: ArtistCache, now: Date) {
  const cached = cache.get(artist.mbid);
  if (cached) return cached;
  const [known] = await db
    .select({ mergedIntoId: artists.mergedIntoId })
    .from(artists)
    .where(eq(artists.mbid, artist.mbid));
  if (known?.mergedIntoId) {
    const [kept] = await db
      .select({ id: artists.id, slug: artists.slug, name: artists.name })
      .from(artists)
      .where(eq(artists.id, known.mergedIntoId));
    cache.set(artist.mbid, kept!);
    return kept!;
  }
  const fields = {
    name: artist.name,
    sortName: artist.sortName,
    disambiguation: artist.disambiguation,
    country: artist.country,
    type: artist.type,
  };
  const [existing] = await db
    .update(artists)
    .set({ ...fields, updatedAt: now })
    .where(eq(artists.mbid, artist.mbid))
    .returning({ id: artists.id, slug: artists.slug, name: artists.name });
  if (existing) {
    cache.set(artist.mbid, existing);
    return existing;
  }
  const slug = await freeSlug(
    slugTaken(db, artists),
    [artist.name, `${artist.name} ${artist.disambiguation ?? artist.country ?? ""}`],
    `artist-${artist.mbid.slice(0, 8)}`,
  );
  const [inserted] = await db
    .insert(artists)
    .values({ ...fields, slug, mbid: artist.mbid })
    .onConflictDoUpdate({ target: artists.mbid, set: { updatedAt: now } })
    .returning({ id: artists.id, slug: artists.slug, name: artists.name });
  cache.set(artist.mbid, inserted!);
  return inserted!;
}

async function creditedArtists(db: Db, credits: ArtistCredit[], cache: ArtistCache, now: Date) {
  const result = [];
  for (const [index, credit] of credits.entries()) {
    const artist = await upsertArtist(db, credit.artist, cache, now);
    result.push({ ...artist, position: index + 1, creditName: credit.creditName });
  }
  return result;
}

function releaseSlugCandidates(group: ReleaseGroupSummary): string[] {
  const artist = group.artists[0]?.artist.name;
  const year = group.firstReleaseDate?.date.slice(0, 4);
  return [
    group.title,
    artist && `${group.title} ${artist}`,
    artist && year && `${group.title} ${artist} ${year}`,
  ].flatMap((c) => (c ? [clean(c)] : []));
}

async function releaseSlug(db: Db, group: ReleaseGroupSummary) {
  return freeSlug(
    slugTaken(db, releases),
    releaseSlugCandidates(group),
    `release-${group.mbid.slice(0, 8)}`,
  );
}

const releaseFields = (group: ReleaseGroupSummary) => ({
  title: group.title,
  type: group.type,
  secondaryTypes: group.secondaryTypes,
  releaseDate: group.firstReleaseDate?.date ?? null,
  releaseDatePrecision: group.firstReleaseDate?.precision ?? null,
});

async function setReleaseArtists(
  db: Db,
  releaseId: string,
  credited: Awaited<ReturnType<typeof creditedArtists>>,
) {
  await db.delete(releaseArtists).where(eq(releaseArtists.releaseId, releaseId));
  if (credited.length === 0) return;
  await db
    .insert(releaseArtists)
    .values(
      credited.map((a) => ({
        releaseId,
        artistId: a.id,
        position: a.position,
        creditName: a.creditName,
      })),
    )
    .onConflictDoNothing();
}

async function setReleaseGenres(db: Db, releaseId: string, names: string[]) {
  await db.delete(releaseGenres).where(eq(releaseGenres.releaseId, releaseId));
  const rows = names.map((name) => ({ slug: clean(name), name })).filter((g) => g.slug);
  if (rows.length === 0) return;
  await db.insert(genres).values(rows).onConflictDoNothing({ target: genres.slug });
  const ids = await db
    .select({ id: genres.id })
    .from(genres)
    .where(
      inArray(
        genres.slug,
        rows.map((g) => g.slug),
      ),
    );
  await db
    .insert(releaseGenres)
    .values(ids.map(({ id: genreId }) => ({ releaseId, genreId })))
    .onConflictDoNothing();
}

/** Inserts or refreshes a track (recording) and its credited artists. */
async function upsertTrack(
  db: Db,
  recording: ProviderRecording,
  releaseTitle: string | null,
  cache: ArtistCache,
  now: Date,
) {
  const credited = await creditedArtists(db, recording.artists, cache, now);
  const [merged] = await db
    .select({ id: tracks.id, slug: tracks.slug, mergedIntoId: tracks.mergedIntoId })
    .from(tracks)
    .where(eq(tracks.mbid, recording.mbid));
  if (merged?.mergedIntoId) {
    const kept = await followMerge(db, tracks, merged);
    return { id: kept.id, slug: kept.slug };
  }
  const fields = { title: recording.title, durationMs: recording.lengthMs };
  let [track] = await db
    .update(tracks)
    .set({ ...fields, updatedAt: now })
    .where(eq(tracks.mbid, recording.mbid))
    .returning({ id: tracks.id, slug: tracks.slug });
  if (!track) {
    const artist = credited[0]?.name;
    const slug = await freeSlug(
      slugTaken(db, tracks),
      [
        artist && `${recording.title} ${artist}`,
        artist && releaseTitle && `${recording.title} ${artist} ${releaseTitle}`,
      ],
      `track-${recording.mbid.slice(0, 8)}`,
    );
    [track] = await db
      .insert(tracks)
      .values({ ...fields, slug, mbid: recording.mbid })
      .onConflictDoUpdate({ target: tracks.mbid, set: { updatedAt: now } })
      .returning({ id: tracks.id, slug: tracks.slug });
  }
  await db.delete(trackArtists).where(eq(trackArtists.trackId, track!.id));
  if (credited.length > 0) {
    await db
      .insert(trackArtists)
      .values(credited.map((a) => ({ trackId: track!.id, artistId: a.id, position: a.position })))
      .onConflictDoNothing();
  }
  return track!;
}

/** Writes a complete release group: artists, release, genres, tracklist, cover. */
async function writeReleaseGroup(
  db: Db,
  group: ReleaseGroupDetail,
  tracklist: Tracklist | null,
  coverUrl: string | null,
  now: Date,
): Promise<string> {
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const cache: ArtistCache = new Map();
    const credited = await creditedArtists(tdb, group.artists, cache, now);
    const fields = {
      ...releaseFields(group),
      coverUrl,
      language: tracklist?.language ?? null,
      referenceReleaseMbid: tracklist?.releaseMbid ?? null,
      tracklistImportedAt: now,
      updatedAt: now,
    };
    let [release] = await tdb
      .update(releases)
      .set(fields)
      .where(eq(releases.mbid, group.mbid))
      .returning({ id: releases.id, slug: releases.slug });
    if (!release) {
      [release] = await tdb
        .insert(releases)
        .values({ ...fields, slug: await releaseSlug(tdb, group), mbid: group.mbid })
        .returning({ id: releases.id, slug: releases.slug });
    }
    const releaseId = release!.id;
    await setReleaseArtists(tdb, releaseId, credited);
    await setReleaseGenres(tdb, releaseId, group.genres);

    await tdb.delete(releaseTracks).where(eq(releaseTracks.releaseId, releaseId));
    const rows = [];
    for (const entry of tracklist?.tracks ?? []) {
      const track = await upsertTrack(tdb, entry.recording, group.title, cache, now);
      rows.push({ releaseId, trackId: track.id, disc: entry.disc, position: entry.position });
    }
    if (rows.length > 0) await tdb.insert(releaseTracks).values(rows).onConflictDoNothing();
    return release!.slug;
  });
}

/* ---------------------------------------------------------------- imports */

async function findBy<T extends typeof artists | typeof releases | typeof tracks>(
  db: Db,
  table: T,
  mbid: string,
) {
  const [row] = await db
    .select()
    .from(table as typeof releases)
    .where(eq(table.mbid, mbid))
    .limit(1);
  return row as T["$inferSelect"] | undefined;
}

/** Album / EP / single with its tracklist. Returns the release slug. */
export async function importReleaseGroup(
  db: Db,
  provider: CatalogProvider,
  mbid: string,
  options: ImportOptions = {},
): Promise<string> {
  const existing = await findBy(db, releases, mbid);
  if (existing?.mergedIntoId) return (await followMerge(db, releases, existing)).slug;
  if (existing?.tracklistImportedAt) return existing.slug;

  return tracked(db, "release_group", mbid, options, async () => {
    const group = await provider.getReleaseGroup(mbid);
    let tracklist: Tracklist | null = null;
    const editions = rankEditions(group.editions).slice(0, EDITION_TRIES);
    for (const [index, edition] of editions.entries()) {
      try {
        tracklist = await provider.getTracklist(edition.mbid);
        break;
      } catch (error) {
        const last = index === editions.length - 1;
        if (!isCatalogError(error) || error.kind === "busy" || last) throw error;
      }
    }
    const coverUrl = await provider.getCoverUrl(mbid);
    return writeReleaseGroup(db, group, tracklist, coverUrl, options.now ?? new Date());
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Release groups of a discography that are not in the catalog yet, with their covers. */
async function newDiscographyGroups(
  db: Db,
  provider: CatalogProvider,
  groups: ReleaseGroupSummary[],
) {
  const known = new Set(
    groups.length === 0
      ? []
      : (
          await db
            .select({ mbid: releases.mbid })
            .from(releases)
            .where(
              inArray(
                releases.mbid,
                groups.map((g) => g.mbid),
              ),
            )
        ).map((r) => r.mbid),
  );
  const stubs = groups.filter((g) => !known.has(g.mbid));
  // Covers for studio releases only (the ones shown first on the artist page).
  const coverTargets = new Set(
    stubs
      .filter((g) => isMainRelease(g.secondaryTypes))
      .slice(0, MAX_DISCOGRAPHY_COVERS)
      .map((g) => g.mbid),
  );
  const covers = new Map(
    await mapLimit([...coverTargets], COVER_CONCURRENCY, async (id) => {
      return [id, await provider.getCoverUrl(id)] as const;
    }),
  );
  return { stubs, covers };
}

/** Adds release groups as stubs (no tracklist yet), credited to their artists. */
async function insertStubs(
  tdb: Db,
  stubs: ReleaseGroupSummary[],
  covers: Map<string, string | null>,
  cache: ArtistCache,
  now: Date,
): Promise<number> {
  if (stubs.length === 0) return 0;
  // Batched: one slug lookup and two inserts for the whole discography.
  const isTaken = await batchSlugCheck(
    tdb,
    releases,
    stubs.flatMap((g) => releaseSlugCandidates(g)),
  );
  const values = [];
  for (const group of stubs) {
    values.push({
      ...releaseFields(group),
      slug: await freeSlug(
        isTaken,
        releaseSlugCandidates(group),
        `release-${group.mbid.slice(0, 8)}`,
      ),
      mbid: group.mbid,
      coverUrl: covers.get(group.mbid) ?? null,
    });
  }
  const inserted = await tdb
    .insert(releases)
    .values(values)
    .onConflictDoNothing({ target: releases.mbid })
    .returning({ id: releases.id, mbid: releases.mbid });
  const groupByMbid = new Map(stubs.map((g) => [g.mbid, g]));
  const links = [];
  for (const { id, mbid: groupMbid } of inserted) {
    const credited = await creditedArtists(tdb, groupByMbid.get(groupMbid!)!.artists, cache, now);
    links.push(
      ...credited.map((a) => ({
        releaseId: id,
        artistId: a.id,
        position: a.position,
        creditName: a.creditName,
      })),
    );
  }
  if (links.length > 0) await tdb.insert(releaseArtists).values(links).onConflictDoNothing();
  return inserted.length;
}

/** Artist and its discography; releases not known yet are added as stubs. Returns the slug. */
export async function importArtist(
  db: Db,
  provider: CatalogProvider,
  mbid: string,
  options: ImportOptions = {},
): Promise<string> {
  const existing = await findBy(db, artists, mbid);
  if (existing?.mergedIntoId) return (await followMerge(db, artists, existing)).slug;
  if (existing?.discographyImportedAt) return existing.slug;

  return tracked(db, "artist", mbid, options, async () => {
    const now = options.now ?? new Date();
    const artist = await provider.getArtist(mbid);
    const groups = await provider.getArtistReleaseGroups(mbid);
    const { stubs, covers } = await newDiscographyGroups(db, provider, groups);

    return db.transaction(async (tx) => {
      const tdb = tx as unknown as Db;
      const cache: ArtistCache = new Map();
      const own = await upsertArtist(tdb, artist, cache, now);
      await tdb
        .update(artists)
        .set({ discographyImportedAt: now, discographyRefreshedAt: now })
        .where(eq(artists.id, own.id));
      await insertStubs(tdb, stubs, covers, cache, now);
      return own.slug;
    });
  });
}

/**
 * Re-reads the discography of an artist already in the catalog and adds the releases that
 * appeared since (new albums for "Recent releases"). Returns how many were added.
 */
export async function refreshArtistDiscography(
  db: Db,
  provider: CatalogProvider,
  artist: { id: string; mbid: string },
  options: ImportOptions = {},
): Promise<number> {
  return tracked(db, "artist", artist.mbid, options, async () => {
    const now = options.now ?? new Date();
    const groups = await provider.getArtistReleaseGroups(artist.mbid);
    const { stubs, covers } = await newDiscographyGroups(db, provider, groups);
    return db.transaction(async (tx) => {
      const tdb = tx as unknown as Db;
      const added = await insertStubs(tdb, stubs, covers, new Map(), now);
      await tdb
        .update(artists)
        .set({ discographyImportedAt: now, discographyRefreshedAt: now })
        .where(eq(artists.id, artist.id));
      return added;
    });
  });
}

/** A recording, imported through the album it first appeared on. Returns the track slug. */
export async function importRecording(
  db: Db,
  provider: CatalogProvider,
  mbid: string,
  options: ImportOptions = {},
): Promise<string> {
  const existing = await findBy(db, tracks, mbid);
  if (existing) return (await followMerge(db, tracks, existing)).slug;

  return tracked(db, "recording", mbid, options, async () => {
    const recording = await provider.getRecording(mbid);
    const official = (status: string | null) => (status === "official" ? 0 : 1);
    const studio = (g: ReleaseGroupSummary) =>
      isMainRelease(g.secondaryTypes) ? (g.type === "album" ? 0 : 1) : 2;
    const [best] = [...recording.appearsOn].sort(
      (a, b) =>
        official(a.edition.status) - official(b.edition.status) ||
        studio(a.releaseGroup) - studio(b.releaseGroup) ||
        (a.edition.date?.date ?? "9999").localeCompare(b.edition.date?.date ?? "9999"),
    );
    if (best) await importReleaseGroup(db, provider, best.releaseGroup.mbid, options);
    // The reference tracklist may use another recording of the song: keep this one too.
    const imported = await findBy(db, tracks, mbid);
    if (imported) return (await followMerge(db, tracks, imported)).slug;
    const track = await upsertTrack(db, recording, null, new Map(), options.now ?? new Date());
    return track.slug;
  });
}

export async function importEntity(
  db: Db,
  provider: CatalogProvider,
  kind: ImportKind,
  mbid: string,
  options: ImportOptions = {},
): Promise<string> {
  if (kind === "artist") return importArtist(db, provider, mbid, options);
  if (kind === "recording") return importRecording(db, provider, mbid, options);
  return importReleaseGroup(db, provider, mbid, options);
}
