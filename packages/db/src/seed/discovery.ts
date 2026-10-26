import { sql } from "drizzle-orm";

import type { DbOrTx } from "../listening-state";
import { recomputeItemState } from "../listening-state";
import * as s from "../schema";
import { artists, fixtureId, releases } from "./fixtures";
import { slugify } from "./slugify";

/*
 * Discovery demo data: listens of the past week from French- and English-speaking members
 * (weekly trends), ratings (top rated) and three releases out in the last month (recent
 * releases). Times and release dates are relative to the seed's `now` and refreshed by every
 * seed, so the home page is never empty. Ids live in their own range (42_000+).
 */

const BRUME = fixtureId(42_001);
const PLUIE = fixtureId(42_002);
const RUELLE = fixtureId(42_003);
const LOU = fixtureId(42_000);
const BASEMENT = fixtureId(42_004);

const entryId = (i: number) => fixtureId(42_100 + i);
const freshReleaseId = (i: number) => fixtureId(42_200 + i);

/*
 * Members of their own, so the activity of the mockup members (and the tests reading it)
 * does not move with the seed's date.
 */
const newMembers = [
  {
    id: BRUME,
    username: "brumedumatin",
    name: "Brume",
    bio: "Café noir, vinyles du dimanche et chansons en français.",
    locale: "fr",
  },
  {
    id: PLUIE,
    username: "pluiedete",
    name: "Inès",
    bio: "J'écoute en marchant, surtout quand il pleut.",
    locale: "fr",
  },
  {
    id: RUELLE,
    username: "ruellebleue",
    name: "Bastien",
    bio: "Rap, chanson et tout ce qui swingue un peu.",
    locale: "fr",
  },
  {
    id: LOU,
    username: "latenightlou",
    name: "Lou",
    bio: "Night shifts, headphones, and too many records for a small flat.",
    locale: "en",
  },
  {
    id: BASEMENT,
    username: "basementbeats",
    name: "Jordan",
    bio: "Soul 45s and whatever the record store clerk recommends.",
    locale: "en",
  },
];

/** Releases out in the last month: [title, artist slug, type, days before the seed, genre]. */
const fresh: [string, string, "album" | "ep" | "single", number, string][] = [
  ["Averse de minuit", "lune-basse", "album", 4, "Jazz"],
  ["Late Train Home", "theo-brightwater", "ep", 11, "Soul"],
  ["Minuit passé, rue Oberkampf", "quartet-sepia", "album", 26, "Jazz"],
];

/** [member, release slug, hours ago, rating 1..10 or null, heart] */
const listens: [string, string, number, number | null, boolean][] = [
  // French-speaking members
  [BRUME, "rue-des-lanternes", 6, 10, true],
  [PLUIE, "rue-des-lanternes", 30, 8, false],
  [RUELLE, "rue-des-lanternes", 50, 9, true],
  [BRUME, "beton-velours", 40, 7, false],
  [RUELLE, "beton-velours", 90, 8, false],
  [PLUIE, "nocturnes-pour-pluie-fine", 100, 9, false],
  [BRUME, "nocturnes-pour-pluie-fine", 120, 10, true],
  [RUELLE, "sous-le-periph", 20, 7, false],
  [PLUIE, "sous-le-periph", 70, 8, true],
  [PLUIE, "spleen-d-automne", 10, 6, false],
  // English-speaking members (two records only: the chart is completed by the fallback)
  [LOU, "midnight-blue-avenue", 15, 8, true],
  [BASEMENT, "midnight-blue-avenue", 25, 9, false],
  [LOU, "brass-and-bone", 60, 9, false],
  [BASEMENT, "brass-and-bone", 80, 8, true],
  [LOU, "gold-leaf-sessions", 35, 10, true],
  // Older ratings, so top-rated charts have records above the minimum number of ratings
  [BRUME, "smoke-rings-at-1-am", 24 * 40, 9, false],
  [LOU, "smoke-rings-at-1-am", 24 * 45, 10, false],
  [PLUIE, "smoke-rings-at-1-am", 24 * 41, 9, false],
  [BRUME, "cafe-creme", 24 * 50, 8, false],
  [LOU, "cafe-creme", 24 * 52, 7, false],
  [BASEMENT, "paper-moon-motel", 24 * 60, 6, false],
];

/** Calendar day in Paris, as a listen date. */
const parisDay = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(at);

export async function seedDiscovery(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const joinedAt = ago(24 * 90);
  const releaseIdBySlug = new Map(releases.map((r) => [r.slug, r.id]));
  const artistIdBySlug = new Map(artists.map((a) => [a.slug, a.id]));

  await tx
    .insert(s.user)
    .values(
      newMembers.map((m) => ({
        id: m.id,
        name: m.name,
        email: `${m.username}@example.test`,
        emailVerified: true,
        createdAt: joinedAt,
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.profiles)
    .values(
      newMembers.map((m) => ({
        userId: m.id,
        username: m.username,
        displayName: m.name,
        bio: m.bio,
        locale: m.locale,
        ageConfirmedAt: joinedAt,
        createdAt: joinedAt,
      })),
    )
    .onConflictDoNothing();
  // Recent releases: dates move with the seed so they stay recent.
  for (const [i, [title, artistSlug, type, days, genre]] of fresh.entries()) {
    const releaseDate = parisDay(ago(days * 24));
    await tx
      .insert(s.releases)
      .values({
        id: freshReleaseId(i),
        slug: slugify(title),
        title,
        type,
        releaseDate,
        releaseDatePrecision: "day",
      })
      .onConflictDoUpdate({ target: s.releases.id, set: { releaseDate } });
    await tx
      .insert(s.releaseArtists)
      .values({
        releaseId: freshReleaseId(i),
        artistId: artistIdBySlug.get(artistSlug)!,
        position: 1,
      })
      .onConflictDoNothing();
    const [genreRow] = await tx
      .select({ id: s.genres.id })
      .from(s.genres)
      .where(sql`${s.genres.name} = ${genre}`);
    if (genreRow) {
      await tx
        .insert(s.releaseGenres)
        .values({ releaseId: freshReleaseId(i), genreId: genreRow.id })
        .onConflictDoNothing();
    }
  }

  // Listens: dated entries whose times follow the seed.
  for (const [i, [userId, slug, hours, rating, liked]] of listens.entries()) {
    const at = ago(hours);
    const releaseId = releaseIdBySlug.get(slug);
    if (!releaseId) throw new Error(`Seed: unknown release "${slug}"`);
    const listenedOn = parisDay(at);
    await tx
      .insert(s.entries)
      .values({
        id: entryId(i),
        userId,
        releaseId,
        listenedOn,
        rating,
        liked,
        createdAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: s.entries.id,
        set: { listenedOn, createdAt: at, updatedAt: at },
      });
    await recomputeItemState(tx, userId, { releaseId });
  }
}
