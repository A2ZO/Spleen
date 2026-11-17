import { and, eq } from "drizzle-orm";
import { TERMS_VERSION } from "@spleen/validators";

import type { DbOrTx } from "../listening-state";
import { recomputeItemState } from "../listening-state";
import * as s from "../schema";
import { artists, fixtureId } from "./fixtures";
import { slugify } from "./slugify";

/*
 * « Souvenirs » demo data (milestone 14, step 3): `vieuxsillons` (Suzanne), followed by nobody
 * and following nobody, without ratings, reviews, lists or shelf. Six invented records: hearts
 * (60 days old, out of the trends and suggestions) on three released on the seed's day 10, 30
 * and 7 years ago (today's anniversaries), and dated listens one year ago to the day (D twice,
 * E once) and two years ago (F, hidden: the most recent year wins). Dates follow the seed's day
 * in Paris, recomputed at each run; on a 29 February every gap goes to the next multiple of 4
 * and F to 8 years, so it stays older than D and E. No track: nothing else in the inventory
 * moves. Ids live in their own range (48_000+); idempotent like the rest of the seed.
 */

const releaseId = (i: number) => fixtureId(48_000 + i);
const MEMBER = fixtureId(48_100);
const entryId = (i: number) => fixtureId(48_200 + i);

interface MemoryRecord {
  title: string;
  type: "album" | "ep" | "single";
  artist: string;
  /** Released on the seed's day this many years ago, or on a fixed date. */
  date: { yearsAgo: number } | string;
}

const records: MemoryRecord[] = [
  { title: "Harbour Postcards", type: "album", artist: "theo-brightwater", date: { yearsAgo: 10 } },
  { title: "Les jours ralentis", type: "album", artist: "quartet-sepia", date: { yearsAgo: 30 } },
  { title: "Petit matin, gare de l'Est", type: "ep", artist: "nora-vidal", date: { yearsAgo: 7 } },
  { title: "Carnet de bord", type: "album", artist: "kassim", date: "2011-04-08" },
  { title: "Paper Boats", type: "single", artist: "juniper-hale", date: "2018-06-29" },
  { title: "Amber Hours", type: "album", artist: "dee-marlowe", date: "2009-02-13" },
];

/** [record index, years ago, UTC hour, relisten] for dated listens; hearts have no date. */
const listens: [number, number, number, boolean][] = [
  [3, 1, 20, false],
  [3, 1, 21, true],
  [4, 1, 22, false],
  [5, 2, 21, false],
];
const hearts = [0, 1, 2];

const parisDay = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(at);

export async function seedMemories(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const joinedAt = ago(800);
  const today = parisDay(now);
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);
  const leapDay = monthDay === "02-29";
  // A 29 February only exists every 4 years (F: 2 → 8, to stay older than D and E).
  const gap = (years: number, isF = false) =>
    !leapDay ? years : isF ? 8 : Math.ceil(years / 4) * 4;
  const dayYearsAgo = (years: number, isF = false) =>
    `${String(year - gap(years, isF)).padStart(4, "0")}-${monthDay}`;

  await tx
    .insert(s.user)
    .values({
      id: MEMBER,
      name: "Suzanne",
      email: "vieuxsillons@example.test",
      emailVerified: true,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();
  await tx
    .insert(s.profiles)
    .values({
      userId: MEMBER,
      username: "vieuxsillons",
      displayName: "Suzanne",
      locale: "fr",
      timeZone: "Europe/Paris",
      showMemories: true,
      ageConfirmedAt: joinedAt,
      termsAcceptedAt: joinedAt,
      termsVersion: TERMS_VERSION,
      createdAt: joinedAt,
    })
    .onConflictDoNothing();

  for (const [i, record] of records.entries()) {
    const id = releaseId(i);
    const releaseDate =
      typeof record.date === "string" ? record.date : dayYearsAgo(record.date.yearsAgo);
    await tx
      .insert(s.releases)
      .values({
        id,
        slug: slugify(record.title),
        title: record.title,
        type: record.type,
        releaseDate,
        releaseDatePrecision: "day",
      })
      .onConflictDoUpdate({ target: s.releases.id, set: { releaseDate } });
    await tx
      .insert(s.releaseArtists)
      .values({
        releaseId: id,
        artistId: artists.find((a) => a.slug === record.artist)!.id,
        position: 1,
      })
      .onConflictDoNothing();
  }

  const written: { entry: number; release: number; at: Date; listenedOn: string | null }[] = [
    ...hearts.map((release, k) => ({ entry: k, release, at: ago(60), listenedOn: null })),
    ...listens.map(([release, years, hour], k) => {
      const listenedOn = dayYearsAgo(years, release === 5);
      return {
        entry: hearts.length + k,
        release,
        at: new Date(`${listenedOn}T${String(hour).padStart(2, "0")}:00:00Z`),
        listenedOn,
      };
    }),
  ];
  for (const { entry, release, at, listenedOn } of written) {
    const isHeart = listenedOn === null;
    const relisten = !isHeart && listens[entry - hearts.length]![3];
    await tx
      .insert(s.entries)
      .values({
        id: entryId(entry),
        userId: MEMBER,
        releaseId: releaseId(release),
        listenedOn,
        liked: isHeart,
        isRelisten: relisten,
        createdAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: s.entries.id,
        set: { listenedOn, createdAt: at, updatedAt: at },
      });
  }
  for (const release of new Set(written.map((w) => w.release))) {
    await recomputeItemState(tx, MEMBER, { releaseId: releaseId(release) });
    // The state's latest change follows the wall clock: keep it at the record's last write.
    const last = Math.max(...written.filter((w) => w.release === release).map((w) => +w.at));
    await tx
      .update(s.userItemState)
      .set({ updatedAt: new Date(last) })
      .where(
        and(eq(s.userItemState.userId, MEMBER), eq(s.userItemState.releaseId, releaseId(release))),
      );
  }
}
