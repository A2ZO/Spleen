import type { Db } from "../client";
import * as s from "../schema";
import { artists, diaryEntries, fixtureId, lists, releases, reviews, users } from "./fixtures";
import { slugify } from "./slugify";

/* Fixed ID ranges for seed rows that have no fixture id (keeps the seed idempotent). */
const TRACK_ID_BASE = 10_000;
const GENRE_ID_BASE = 700;
const MOOD_ID_BASE = 800;
const LIST_ITEM_ID_BASE = 20_000;

/** Suggested moods ("Carnet d'humeur"). */
const suggestedMoods = [
  { slug: "rain", labelFr: "Pluie", labelEn: "Rain" },
  { slug: "night", labelFr: "La nuit", labelEn: "Night" },
  { slug: "sunday-morning", labelFr: "Dimanche matin", labelEn: "Sunday morning" },
  { slug: "commute", labelFr: "Trajet", labelEn: "Commute" },
];

/** A few moods on demo diary entries, by fixture entry number. */
const entryMoodSlugs: Record<number, string[]> = {
  403: ["rain", "night"],
  406: ["sunday-morning"],
  409: ["night"],
  411: ["commute"],
};

const demoFollows: [string, string][] = [
  ["nuitblanche", "vinylvince"],
  ["vinylvince", "nuitblanche"],
  ["rainydaysam", "nuitblanche"],
];

/**
 * Inserts the demo dataset (same fictional data as the mockup fixtures).
 * Idempotent: every row has a stable id or natural key and conflicts are ignored.
 */
export async function seed(db: Db): Promise<void> {
  const releaseIdBySlug = new Map(releases.map((r) => [r.slug, r.id]));
  const artistIdBySlug = new Map(artists.map((a) => [a.slug, a.id]));
  const userIdByName = new Map(users.map((u) => [u.username, u.id]));
  const get = <T>(map: Map<string, T>, key: string): T => {
    const value = map.get(key);
    if (value === undefined) throw new Error(`Seed: unknown key "${key}"`);
    return value;
  };

  const genreNames = [...new Set(releases.flatMap((r) => r.genres))];
  const genreIdByName = new Map(genreNames.map((name, i) => [name, fixtureId(GENRE_ID_BASE + i)]));
  const moodIdBySlug = new Map(suggestedMoods.map((m, i) => [m.slug, fixtureId(MOOD_ID_BASE + i)]));

  await db.transaction(async (tx) => {
    // Catalog
    await tx
      .insert(s.artists)
      .values(artists.map((a) => ({ id: a.id, slug: a.slug, name: a.name })))
      .onConflictDoNothing();

    await tx
      .insert(s.genres)
      .values(
        genreNames.map((name) => ({ id: get(genreIdByName, name), slug: slugify(name), name })),
      )
      .onConflictDoNothing();

    await tx
      .insert(s.releases)
      .values(
        releases.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          type: r.type,
          releaseDate: r.releaseDate,
          releaseDatePrecision: "day" as const,
          language: r.lang,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(s.releaseArtists)
      .values(
        releases.flatMap((r) =>
          r.artistSlugs.map((slug, i) => ({
            releaseId: r.id,
            artistId: get(artistIdBySlug, slug),
            position: i + 1,
          })),
        ),
      )
      .onConflictDoNothing();

    await tx
      .insert(s.releaseGenres)
      .values(
        releases.flatMap((r) =>
          r.genres.map((name) => ({ releaseId: r.id, genreId: get(genreIdByName, name) })),
        ),
      )
      .onConflictDoNothing();

    const trackRows = releases.flatMap((r, ri) =>
      r.tracks.map(([title, seconds], ti) => ({
        id: fixtureId(TRACK_ID_BASE + ri * 100 + ti + 1),
        slug: `${slugify(title)}-${r.slug}`,
        title,
        durationMs: seconds * 1000,
        releaseId: r.id,
        position: ti + 1,
        artistSlugs: r.artistSlugs,
      })),
    );
    await tx
      .insert(s.tracks)
      .values(trackRows.map(({ id, slug, title, durationMs }) => ({ id, slug, title, durationMs })))
      .onConflictDoNothing();
    await tx
      .insert(s.releaseTracks)
      .values(
        trackRows.map((t) => ({ releaseId: t.releaseId, trackId: t.id, position: t.position })),
      )
      .onConflictDoNothing();
    await tx
      .insert(s.trackArtists)
      .values(
        trackRows.flatMap((t) =>
          t.artistSlugs.map((slug, i) => ({
            trackId: t.id,
            artistId: get(artistIdBySlug, slug),
            position: i + 1,
          })),
        ),
      )
      .onConflictDoNothing();

    // Members
    await tx
      .insert(s.user)
      .values(
        users.map((u) => ({
          id: u.id,
          name: u.displayName,
          email: `${u.username}@example.test`,
          emailVerified: true,
          createdAt: new Date(`${u.joinedOn}T12:00:00Z`),
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(s.profiles)
      .values(
        users.map((u) => ({
          userId: u.id,
          username: u.username,
          displayName: u.displayName,
          bio: u.bio,
          ageConfirmedAt: new Date(`${u.joinedOn}T12:00:00Z`),
          createdAt: new Date(`${u.joinedOn}T12:00:00Z`),
        })),
      )
      .onConflictDoNothing();

    const shelfRows = users.flatMap((u) =>
      u.shelf.map((slug, i) => ({
        userId: u.id,
        position: i + 1,
        releaseId: get(releaseIdBySlug, slug),
      })),
    );
    if (shelfRows.length > 0) await tx.insert(s.favorites).values(shelfRows).onConflictDoNothing();

    await tx
      .insert(s.follows)
      .values(
        demoFollows.map(([from, to]) => ({
          followerId: get(userIdByName, from),
          followeeId: get(userIdByName, to),
        })),
      )
      .onConflictDoNothing();

    // Listening
    await tx
      .insert(s.moods)
      .values(suggestedMoods.map((m) => ({ id: get(moodIdBySlug, m.slug), ...m })))
      .onConflictDoNothing();

    await tx
      .insert(s.entries)
      .values(
        diaryEntries.map((e) => ({
          id: e.id,
          userId: get(userIdByName, e.username),
          releaseId: get(releaseIdBySlug, e.releaseSlug),
          listenedOn: e.listenedOn,
          rating: e.rating,
          liked: e.liked,
          isRelisten: e.relisten,
          format: e.format,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(s.entryMoods)
      .values(
        Object.entries(entryMoodSlugs).flatMap(([n, slugs]) =>
          slugs.map((slug) => ({ entryId: fixtureId(Number(n)), moodId: get(moodIdBySlug, slug) })),
        ),
      )
      .onConflictDoNothing();

    // Latest state per member and release, derived from the diary (newest entry wins).
    const latest = new Map<string, (typeof diaryEntries)[number]>();
    for (const e of [...diaryEntries].sort((a, b) => a.listenedOn.localeCompare(b.listenedOn))) {
      latest.set(`${e.username}|${e.releaseSlug}`, e);
    }
    await tx
      .insert(s.userItemState)
      .values(
        [...latest.values()].map((e) => ({
          userId: get(userIdByName, e.username),
          releaseId: get(releaseIdBySlug, e.releaseSlug),
          rating: e.rating,
          liked: diaryEntries.some(
            (o) => o.username === e.username && o.releaseSlug === e.releaseSlug && o.liked,
          ),
          listened: true,
        })),
      )
      .onConflictDoNothing();

    // Content
    await tx
      .insert(s.reviews)
      .values(
        reviews.map((r) => ({
          id: r.id,
          userId: get(userIdByName, r.username),
          releaseId: get(releaseIdBySlug, r.releaseSlug),
          rating: r.rating,
          body: r.body,
          lang: r.lang,
          createdAt: new Date(r.createdAt),
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(s.lists)
      .values(
        lists.map((l) => ({
          id: l.id,
          userId: get(userIdByName, l.username),
          title: l.title,
          description: l.description,
          ranked: l.ranked,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(s.listItems)
      .values(
        lists.flatMap((l, li) =>
          l.releaseSlugs.map((slug, i) => ({
            id: fixtureId(LIST_ITEM_ID_BASE + li * 100 + i + 1),
            listId: l.id,
            releaseId: get(releaseIdBySlug, slug),
            position: i + 1,
          })),
        ),
      )
      .onConflictDoNothing();
  });
}
