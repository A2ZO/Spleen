import type { CatalogProvider, PartialDate, ReleaseGroupDetail } from "@spleen/catalog";
import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  importReleaseGroup,
  refreshArtistDiscography,
  refreshReleaseDate,
} from "./lib/catalog/import";

/*
 * Date tracking of releases (`lib/catalog/release-dates.ts`): `announced_at` once,
 * `release_date_changed_at` when an announced date leaves its period, past dates never
 * rewritten by a discography re-read. A fake provider answers with the dates of each test.
 */

let handle: DbHandle;
const ARTIST_MBID = "11111111-1111-4111-8111-111111111111";
let artistId: string;
const day = (iso: string) => new Date(`${iso}T03:00:00Z`);
const NOW = day("2026-11-16");

const date = (value: string): PartialDate => ({
  date: value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value,
  precision: value.length === 4 ? "year" : value.length === 7 ? "month" : "day",
});

let mbidCounter = 0;
const newMbid = () => `22222222-2222-4222-8222-${String(++mbidCounter).padStart(12, "0")}`;

/** A provider whose discography and release groups come from `groups`. */
function provider(groups: Map<string, PartialDate | null>): CatalogProvider {
  const detail = (mbid: string): ReleaseGroupDetail => ({
    mbid,
    title: `Disque ${mbid.slice(-3)}`,
    type: "album",
    secondaryTypes: [],
    firstReleaseDate: groups.get(mbid) ?? null,
    artists: [
      {
        artist: {
          mbid: ARTIST_MBID,
          name: "Artiste",
          sortName: null,
          disambiguation: null,
          country: null,
          type: null,
        },
        creditName: null,
      },
    ],
    genres: [],
    editions: [],
  });
  return {
    getArtistReleaseGroups: async () => [...groups.keys()].map(detail),
    getReleaseGroup: async (mbid: string) => detail(mbid),
    getCoverUrl: async () => null,
  } as unknown as CatalogProvider;
}

async function row(mbid: string) {
  const [r] = await handle.db.select().from(schema.releases).where(eq(schema.releases.mbid, mbid));
  return r!;
}

const refresh = (groups: Map<string, PartialDate | null>, now: Date) =>
  refreshArtistDiscography(
    handle.db,
    provider(groups),
    { id: artistId, mbid: ARTIST_MBID },
    { now },
  );

beforeAll(async () => {
  handle = await createTestDb();
  const [artist] = await handle.db
    .insert(schema.artists)
    .values({ slug: "artiste", name: "Artiste", mbid: ARTIST_MBID })
    .returning({ id: schema.artists.id });
  artistId = artist!.id;
}, 60_000);

afterAll(() => handle.close());

describe("announced_at", () => {
  it("is set for a date after the day of the import, once", async () => {
    const mbid = newMbid();
    await refresh(new Map([[mbid, date("2026-12-04")]]), NOW);
    expect((await row(mbid)).announcedAt).toEqual(NOW);
    await refresh(new Map([[mbid, date("2026-12-05")]]), day("2026-11-20"));
    expect((await row(mbid)).announcedAt).toEqual(NOW);
  });

  it("is not set for today or a past date", async () => {
    const [today, past] = [newMbid(), newMbid()];
    await refresh(
      new Map([
        [today, date("2026-11-16")],
        [past, date("2025-03-02")],
      ]),
      NOW,
    );
    expect((await row(today)).announcedAt).toBeNull();
    expect((await row(past)).announcedAt).toBeNull();
  });

  it("counts a month or a year by its first day", async () => {
    const [thisMonth, nextMonth, thisYear, nextYear] = [newMbid(), newMbid(), newMbid(), newMbid()];
    await refresh(
      new Map([
        [thisMonth, date("2026-11")],
        [nextMonth, date("2026-12")],
        [thisYear, date("2026")],
        [nextYear, date("2027")],
      ]),
      NOW,
    );
    expect((await row(thisMonth)).announcedAt).toBeNull();
    expect((await row(nextMonth)).announcedAt).toEqual(NOW);
    expect((await row(thisYear)).announcedAt).toBeNull();
    expect((await row(nextYear)).announcedAt).toEqual(NOW);
  });

  it("is set when a complete release group is imported", async () => {
    const mbid = newMbid();
    await importReleaseGroup(handle.db, provider(new Map([[mbid, date("2027-02")]])), mbid, {
      now: NOW,
    });
    expect(await row(mbid)).toMatchObject({ announcedAt: NOW, releaseDate: "2027-02-01" });
  });
});

describe("release_date_changed_at", () => {
  it("is set when an announced date moves to another day", async () => {
    const mbid = newMbid();
    await refresh(new Map([[mbid, date("2026-12-04")]]), NOW);
    const later = day("2026-11-18");
    await refresh(new Map([[mbid, date("2026-12-11")]]), later);
    expect(await row(mbid)).toMatchObject({
      releaseDate: "2026-12-11",
      releaseDateChangedAt: later,
    });
  });

  it("is not set when precision is only added inside the same period", async () => {
    const [year, month] = [newMbid(), newMbid()];
    await refresh(
      new Map([
        [year, date("2027")],
        [month, date("2027-03")],
      ]),
      NOW,
    );
    await refresh(
      new Map([
        [year, date("2027-03-14")],
        [month, date("2027-03-20")],
      ]),
      day("2026-11-25"),
    );
    expect(await row(year)).toMatchObject({
      releaseDate: "2027-03-14",
      releaseDateChangedAt: null,
    });
    expect(await row(month)).toMatchObject({
      releaseDate: "2027-03-20",
      releaseDateChangedAt: null,
    });
  });

  it("is set when a month moves to another month", async () => {
    const mbid = newMbid();
    await refresh(new Map([[mbid, date("2027-03")]]), NOW);
    await refresh(new Map([[mbid, date("2027-05-02")]]), day("2026-11-25"));
    expect((await row(mbid)).releaseDateChangedAt).toEqual(day("2026-11-25"));
  });

  it("is never set for a release that was not announced before the move", async () => {
    const mbid = newMbid();
    await refresh(new Map([[mbid, date("2026-11")]]), NOW);
    await refresh(new Map([[mbid, date("2026-12-08")]]), day("2026-11-20"));
    expect(await row(mbid)).toMatchObject({
      releaseDate: "2026-12-08",
      releaseDateChangedAt: null,
      // Seen with a future date for the first time: announced now, not "changed".
      announcedAt: day("2026-11-20"),
    });
  });
});

describe("discography re-read", () => {
  it("never rewrites a past date", async () => {
    const mbid = newMbid();
    await refresh(new Map([[mbid, date("1998-05-04")]]), NOW);
    await refresh(new Map([[mbid, date("1997")]]), day("2026-11-25"));
    expect((await row(mbid)).releaseDate).toBe("1998-05-04");
  });

  it("re-reads one release group for its date only", async () => {
    const mbid = newMbid();
    await refresh(new Map([[mbid, date("2026-12-04")]]), NOW);
    const moved = provider(new Map([[mbid, date("2027-01-15")]]));
    expect(await refreshReleaseDate(handle.db, moved, mbid, { now: day("2026-11-20") })).toBe(true);
    expect(await refreshReleaseDate(handle.db, moved, mbid, { now: day("2026-11-21") })).toBe(
      false,
    );
    expect(await row(mbid)).toMatchObject({
      releaseDate: "2027-01-15",
      releaseDateChangedAt: day("2026-11-20"),
      tracklistImportedAt: null,
    });
  });
});
