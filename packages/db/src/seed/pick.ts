import { and, eq } from "drizzle-orm";

import type { DbOrTx } from "../listening-state";
import { setWantToListen } from "../listening-state";
import * as s from "../schema";
import { artists, fixtureId, users } from "./fixtures";
import { slugify } from "./slugify";

/*
 * « Tire un disque » demo data (milestone 13, step 5): six invented records, all out, in
 * `nuitblanche`'s « À écouter » list and never listened to, so every filter of `/pick` has
 * something to draw: albums of about 45, 72 and 38 minutes, an EP of about 18 minutes, a single
 * of about 7 minutes and an album without tracks (unknown length). No listen, rating or heart:
 * trends, stats and suggestions stay as they were. Ids live in their own range (47_000+);
 * idempotent like the rest of the seed. Titles avoid the words the search tests type. Each one
 * was queued a day apart before the seed runs, so the « À écouter » tab has a fixed order (rows
 * inserted in one transaction share its `now()`).
 */

const releaseId = (i: number) => fixtureId(47_000 + i);
const trackId = (i: number, j: number) => fixtureId(47_100 + i * 20 + j);

interface PickRecord {
  title: string;
  type: "album" | "ep" | "single";
  date: string;
  artist: string;
  /** [title, seconds] */
  tracks: [string, number][];
}

const records: PickRecord[] = [
  {
    title: "Les horloges du canal",
    type: "album",
    date: "2014-03-21",
    artist: "quartet-sepia",
    tracks: [
      ["Écluse numéro trois", 402],
      ["Péniche à quai", 371],
      ["Le gardien des vannes", 445],
      ["Brume sur l'Ourcq", 389],
      ["Pendule arrêtée", 356],
      ["Retour par les berges", 412],
      ["Minuit moins le quart", 325],
    ],
  },
  {
    title: "Long Way to Kestrel Bay",
    type: "album",
    date: "2017-09-08",
    artist: "theo-brightwater",
    tracks: [
      ["Leaving Harrow Road", 431],
      ["Salt in the Engine", 398],
      ["Kestrel Bay", 512],
      ["Lighthouse Keeper's Daughter", 455],
      ["Driftwood Sermon", 402],
      ["Low Tide Waltz", 467],
      ["The Ferry Never Came", 421],
      ["Gulls Over Dunmore", 389],
      ["Harbour Lights Go Out", 448],
      ["Home by Morning", 397],
    ],
  },
  {
    title: "Fenêtres sur cour",
    type: "album",
    date: "2021-05-14",
    artist: "nora-vidal",
    tracks: [
      ["Le voisin du troisième", 352],
      ["Linge qui sèche", 389],
      ["Géraniums", 401],
      ["Persiennes", 376],
      ["Concierge", 364],
      ["Dernière lumière", 398],
    ],
  },
  {
    title: "Tarmac",
    type: "ep",
    date: "2019-11-22",
    artist: "kassim",
    tracks: [
      ["Piste 27", 268],
      ["Escale", 291],
      ["Bagages perdus", 254],
      ["Porte F", 267],
    ],
  },
  {
    title: "Origami Weather",
    type: "single",
    date: "2016-06-03",
    artist: "juniper-hale",
    tracks: [
      ["Origami Weather", 238],
      ["Folded Sky", 192],
    ],
  },
  {
    title: "Sans étiquette",
    type: "album",
    date: "2012-02-10",
    artist: "dee-marlowe",
    tracks: [],
  },
];

export async function seedPick(tx: DbOrTx, now: Date): Promise<void> {
  const nuit = users.find((u) => u.username === "nuitblanche")!.id;

  for (const [i, record] of records.entries()) {
    const id = releaseId(i);
    const slug = slugify(record.title);
    const artistId = artists.find((a) => a.slug === record.artist)!.id;
    await tx
      .insert(s.releases)
      .values({
        id,
        slug,
        title: record.title,
        type: record.type,
        releaseDate: record.date,
        releaseDatePrecision: "day",
      })
      .onConflictDoNothing();
    await tx
      .insert(s.releaseArtists)
      .values({ releaseId: id, artistId, position: 1 })
      .onConflictDoNothing();
    if (record.tracks.length > 0) {
      await tx
        .insert(s.tracks)
        .values(
          record.tracks.map(([title, seconds], j) => ({
            id: trackId(i, j),
            slug: `${slugify(title)}-${slug}`,
            title,
            durationMs: seconds * 1000,
          })),
        )
        .onConflictDoNothing();
      await tx
        .insert(s.releaseTracks)
        .values(
          record.tracks.map((_, j) => ({ releaseId: id, trackId: trackId(i, j), position: j + 1 })),
        )
        .onConflictDoNothing();
      await tx
        .insert(s.trackArtists)
        .values(record.tracks.map((_, j) => ({ trackId: trackId(i, j), artistId, position: 1 })))
        .onConflictDoNothing();
    }
    await setWantToListen(tx, nuit, { releaseId: id }, true);
    await tx
      .update(s.userItemState)
      .set({ updatedAt: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000) })
      .where(and(eq(s.userItemState.userId, nuit), eq(s.userItemState.releaseId, id)));
  }
}
