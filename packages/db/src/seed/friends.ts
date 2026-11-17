import { TERMS_VERSION } from "@spleen/validators";

import type { DbOrTx } from "../listening-state";
import { recomputeItemState } from "../listening-state";
import * as s from "../schema";
import { artists, fixtureId, users } from "./fixtures";
import { slugify } from "./slugify";

/*
 * « Tes amis sur ce disque » demo data (milestone 13, step 4): an invented record, seven
 * members followed by `nuitblanche` with a rating and/or a heart on it — six shown (the e2e
 * expects « Voir tous tes amis (6) »), one with a private diary left out. Listens are 41 to
 * 70 days old (out of the trends and suggestions) and rated 6 to 8 (out of the top of « les
 * mieux notés »). Ids live in their own range (46_000+); idempotent like the rest of the seed.
 */

const RELEASE = fixtureId(46_000);
const memberId = (i: number) => fixtureId(46_100 + i);
const trackId = (i: number) => fixtureId(46_200 + i);
const entryId = (i: number) => fixtureId(46_300 + i);

const TITLE = "Dernier métro pour Belleville";

/** [title, seconds] */
const tracks: [string, number][] = [
  ["Quai désert", 214],
  ["Correspondance manquée", 263],
  ["Les néons de la rue de Tourtille", 301],
  ["Ticket froissé", 187],
  ["Pyrénées, 1 h 12", 342],
  ["Remonter à pied", 276],
];

/** [username, display name, private diary, days ago, rating 1..10 or null, heart] */
const friends: [string, string, boolean, number, number | null, boolean][] = [
  ["metrominuit", "Salomé", false, 41, 8, true],
  ["quaidelaloire", "Malik", false, 44, null, true],
  ["ticketchoc", "Odile", false, 48, 7, false],
  ["bellevilleblues", "Rémi", false, 52, 6, true],
  ["contrebandiere", "Lina", false, 57, 7, false],
  ["derniertrain", "Hugo", false, 63, 8, false],
  ["journalsecret", "Anouk", true, 70, 7, false],
];

const parisDay = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(at);

export async function seedFriends(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const joinedAt = ago(120);
  const nuit = users.find((u) => u.username === "nuitblanche")!.id;
  const artistId = artists.find((a) => a.slug === "lune-basse")!.id;
  const slug = slugify(TITLE);

  await tx
    .insert(s.releases)
    .values({
      id: RELEASE,
      slug,
      title: TITLE,
      type: "album",
      releaseDate: "2019-10-04",
      releaseDatePrecision: "day",
      language: "fr",
    })
    .onConflictDoNothing();
  await tx
    .insert(s.releaseArtists)
    .values({ releaseId: RELEASE, artistId, position: 1 })
    .onConflictDoNothing();
  await tx
    .insert(s.tracks)
    .values(
      tracks.map(([title, seconds], i) => ({
        id: trackId(i),
        slug: `${slugify(title)}-${slug}`,
        title,
        durationMs: seconds * 1000,
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.releaseTracks)
    .values(tracks.map((_, i) => ({ releaseId: RELEASE, trackId: trackId(i), position: i + 1 })))
    .onConflictDoNothing();
  await tx
    .insert(s.trackArtists)
    .values(tracks.map((_, i) => ({ trackId: trackId(i), artistId, position: 1 })))
    .onConflictDoNothing();

  await tx
    .insert(s.user)
    .values(
      friends.map(([username, name], i) => ({
        id: memberId(i),
        name,
        email: `${username}@example.test`,
        emailVerified: true,
        createdAt: joinedAt,
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.profiles)
    .values(
      friends.map(([username, name, diaryPrivate], i) => ({
        userId: memberId(i),
        username,
        displayName: name,
        locale: "fr",
        diaryPrivate,
        ageConfirmedAt: joinedAt,
        termsAcceptedAt: joinedAt,
        termsVersion: TERMS_VERSION,
        createdAt: joinedAt,
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.follows)
    .values(
      friends.map((_, i) => ({ followerId: nuit, followeeId: memberId(i), createdAt: ago(60) })),
    )
    .onConflictDoNothing();

  for (const [i, [, , , days, rating, liked]] of friends.entries()) {
    const at = ago(days);
    const listenedOn = parisDay(at);
    await tx
      .insert(s.entries)
      .values({
        id: entryId(i),
        userId: memberId(i),
        releaseId: RELEASE,
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
    await recomputeItemState(tx, memberId(i), { releaseId: RELEASE });
  }
}
