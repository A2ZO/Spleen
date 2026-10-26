import { sql } from "drizzle-orm";

import type { Db } from "../client";
import { recomputeItemState, setWantToListen } from "../listening-state";
import * as s from "../schema";
import { seedCrate } from "./crate";
import { seedDiscovery } from "./discovery";
import {
  artists,
  diaryEntries,
  fixtureId,
  lists,
  releases,
  reviews,
  toListen,
  users,
} from "./fixtures";
import { seedLists } from "./lists";
import { slugify } from "./slugify";
import { seedSocial } from "./social";

/* Fixed ID ranges for seed rows that have no fixture id (keeps the seed idempotent). */
const TRACK_ID_BASE = 10_000;
const GENRE_ID_BASE = 700;
const MOOD_ID_BASE = 800;
const LIST_ITEM_ID_BASE = 20_000;

/**
 * Suggested moods ("Carnet d'humeur"). Ids follow this order: append new moods at the end.
 * Labels are updated on every seed; slugs never change (personal moods may reuse them).
 */
export const suggestedMoods = [
  { slug: "rain", labelFr: "Pluie sur la vitre", labelEn: "Rain on the window" },
  { slug: "night", labelFr: "Tard dans la nuit", labelEn: "Late night" },
  { slug: "sunday-morning", labelFr: "Dimanche matin", labelEn: "Sunday morning" },
  { slug: "commute", labelFr: "Trajet", labelEn: "Commute" },
  { slug: "one-am", labelFr: "Une heure du matin", labelEn: "1 a.m." },
  { slug: "first-coffee", labelFr: "Premier café", labelEn: "First coffee" },
  { slug: "walk", labelFr: "Balade", labelEn: "Out for a walk" },
  { slug: "on-the-road", labelFr: "Sur la route", labelEn: "On the road" },
  { slug: "cooking", labelFr: "En cuisinant", labelEn: "Cooking" },
  { slug: "reading", labelFr: "En lisant", labelEn: "Reading" },
  { slug: "focus", labelFr: "Concentration", labelEn: "Deep focus" },
  { slug: "headphones", labelFr: "Au casque", labelEn: "Headphones on" },
  { slug: "spleen", labelFr: "Spleen", labelEn: "Spleen" },
  { slug: "nostalgia", labelFr: "Nostalgie", labelEn: "Nostalgia" },
  { slug: "heartbreak", labelFr: "Cœur brisé", labelEn: "Heartbreak" },
  { slug: "date-night", labelFr: "En amoureux", labelEn: "Date night" },
  { slug: "with-friends", labelFr: "Entre amis", labelEn: "With friends" },
  { slug: "good-mood", labelFr: "Bonne humeur", labelEn: "Good mood" },
  { slug: "autumn", labelFr: "Automne", labelEn: "Autumn" },
  { slug: "summer-evening", labelFr: "Soir d'été", labelEn: "Summer evening" },
];

/** Undated listens sort as edited the evening before the demo "today" (2026-10-20). */
const UNDATED_EDITED_AT = new Date("2026-10-19T20:00:00Z");

/**
 * Inserts the demo dataset (same fictional data as the mockup fixtures).
 * Idempotent: every row has a stable id or natural key and conflicts are ignored.
 * `now` anchors the social demo (likes, comments, notifications of the last days).
 */
export async function seed(db: Db, options: { now?: Date } = {}): Promise<void> {
  const now = options.now ?? new Date();
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
    const trackIdByPosition = new Map(
      trackRows.map((t) => [
        `${releases.find((r) => r.id === t.releaseId)!.slug}#${t.position}`,
        t.id,
      ]),
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

    // Listening
    await tx
      .insert(s.moods)
      .values(suggestedMoods.map((m) => ({ id: get(moodIdBySlug, m.slug), ...m })))
      .onConflictDoUpdate({
        target: s.moods.id,
        set: { labelFr: sql`excluded.label_fr`, labelEn: sql`excluded.label_en` },
      });

    // Edit times follow listening dates, so the "most recently modified" rule is realistic.
    await tx
      .insert(s.entries)
      .values(
        diaryEntries.map((e) => {
          const editedAt = e.listenedOn ? new Date(`${e.listenedOn}T21:00:00Z`) : UNDATED_EDITED_AT;
          return {
            id: e.id,
            userId: get(userIdByName, e.username),
            releaseId: get(releaseIdBySlug, e.releaseSlug),
            listenedOn: e.listenedOn,
            rating: e.rating,
            liked: e.liked,
            isRelisten: e.relisten,
            format: e.format,
            createdAt: editedAt,
            updatedAt: editedAt,
          };
        }),
      )
      .onConflictDoNothing();

    const moodRows = diaryEntries.flatMap((e) =>
      e.moods.map((slug) => ({ entryId: e.id, moodId: get(moodIdBySlug, slug) })),
    );
    if (moodRows.length > 0) await tx.insert(s.entryMoods).values(moodRows).onConflictDoNothing();

    const trackRatingRows = diaryEntries.flatMap((e) =>
      Object.entries(e.trackRatings).map(([position, rating]) => ({
        entryId: e.id,
        trackId: get(trackIdByPosition, `${e.releaseSlug}#${position}`),
        rating,
      })),
    );
    if (trackRatingRows.length > 0) {
      await tx.insert(s.trackRatings).values(trackRatingRows).onConflictDoNothing();
    }

    // Member state is derived from the diary by the same code as the API.
    for (const u of users) {
      const userId = u.id;
      for (const { releaseSlugs } of toListen.filter((q) => q.username === u.username)) {
        for (const slug of releaseSlugs) {
          await setWantToListen(tx, userId, { releaseId: get(releaseIdBySlug, slug) }, true);
        }
      }
      const targets = new Map<string, { releaseId: string } | { trackId: string }>();
      for (const e of diaryEntries.filter((d) => d.username === u.username)) {
        targets.set(e.releaseSlug, { releaseId: get(releaseIdBySlug, e.releaseSlug) });
        for (const position of Object.keys(e.trackRatings)) {
          const trackId = get(trackIdByPosition, `${e.releaseSlug}#${position}`);
          targets.set(trackId, { trackId });
        }
      }
      for (const target of targets.values()) await recomputeItemState(tx, userId, target);
    }

    // Content
    await tx
      .insert(s.reviews)
      .values(
        reviews.map((r) => ({
          id: r.id,
          userId: get(userIdByName, r.username),
          releaseId: get(releaseIdBySlug, r.releaseSlug),
          entryId: r.entryId,
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

    await seedCrate(tx, [...genreIdByName.values()]);
    await seedSocial(tx, now);
    await seedDiscovery(tx, now);
    await seedLists(tx, now);
  });
}
