import type { DbOrTx } from "../listening-state";
import * as s from "../schema";
import { artists, fixtureId, users } from "./fixtures";
import { slugify } from "./slugify";

/*
 * Upcoming releases demo data (milestone 11): `nuitblanche` follows three artists,
 * `vinylvince` two (one in common), and six announced releases with invented titles cover
 * every section of « Mes sorties à venir ». Dates are relative to the seed's day in Paris
 * and refreshed by every seed. No MusicBrainz id: the nightly job never re-reads demo data.
 * Ids live in their own range (45_000+).
 */

const releaseId = (i: number) => fixtureId(45_100 + i);

const follows: [string, string][] = [
  ["nuitblanche", "lune-basse"],
  ["nuitblanche", "quartet-sepia"],
  ["nuitblanche", "theo-brightwater"],
  ["vinylvince", "theo-brightwater"],
  ["vinylvince", "kassim"],
];

type When =
  { days: number } | { nextMonthDay: number } | { monthsAhead: number } | { nextYear: true };

/** [title, artist slug, type, when, date moved once] */
const upcoming: [string, string, "album" | "ep" | "single", When, boolean][] = [
  ["Les heures bleues", "lune-basse", "album", { days: 3 }, false],
  ["Slow Burn Sessions", "theo-brightwater", "ep", { days: 10 }, false],
  ["Sépia, deuxième tirage", "quartet-sepia", "album", { nextMonthDay: 15 }, false],
  ["Paper Lanterns", "kassim", "single", { monthsAhead: 2 }, false],
  ["Nuit polaire", "lune-basse", "album", { nextYear: true }, false],
  ["Morning Static", "theo-brightwater", "album", { days: 24 }, true],
];

const parisDay = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(at);

/** Stored date (a month or a year on its first day) and precision. */
function dateOf(when: When, today: string): { date: string; precision: "day" | "month" | "year" } {
  const base = new Date(`${today}T00:00:00Z`);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if ("days" in when) {
    base.setUTCDate(base.getUTCDate() + when.days);
    return { date: iso(base), precision: "day" };
  }
  if ("nextMonthDay" in when) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, when.nextMonthDay));
    return { date: iso(d), precision: "day" };
  }
  if ("monthsAhead" in when) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + when.monthsAhead, 1));
    return { date: iso(d), precision: "month" };
  }
  return { date: `${base.getUTCFullYear() + 1}-01-01`, precision: "year" };
}

export async function seedUpcoming(tx: DbOrTx, now: Date): Promise<void> {
  const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const today = parisDay(now);
  const artistIdBySlug = new Map(artists.map((a) => [a.slug, a.id]));
  const userIdByName = new Map(users.map((u) => [u.username, u.id]));

  await tx
    .insert(s.artistFollows)
    .values(
      follows.map(([username, artistSlug]) => ({
        userId: userIdByName.get(username)!,
        artistId: artistIdBySlug.get(artistSlug)!,
        createdAt: ago(20),
      })),
    )
    .onConflictDoNothing();

  for (const [i, [title, artistSlug, type, when, moved]] of upcoming.entries()) {
    const { date, precision } = dateOf(when, today);
    const dates = {
      releaseDate: date,
      releaseDatePrecision: precision,
      announcedAt: ago(30),
      releaseDateChangedAt: moved ? ago(2) : null,
    };
    await tx
      .insert(s.releases)
      .values({ id: releaseId(i), slug: slugify(title), title, type, ...dates })
      .onConflictDoUpdate({ target: s.releases.id, set: dates });
    await tx
      .insert(s.releaseArtists)
      .values({ releaseId: releaseId(i), artistId: artistIdBySlug.get(artistSlug)!, position: 1 })
      .onConflictDoNothing();
  }
}
