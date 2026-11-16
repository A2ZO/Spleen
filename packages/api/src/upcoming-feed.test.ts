import { randomUUID } from "node:crypto";

import type {
  CatalogProvider,
  FreshRelease,
  ListenBrainzClient,
  PartialDate,
  ReleaseGroupDetail,
} from "@spleen/catalog";
import { CatalogError } from "@spleen/catalog";
import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runUpcomingFeed } from "./lib/catalog/upcoming-feed";

/* Nightly feed of upcoming releases (milestone 11, step 2): ListenBrainz → MusicBrainz. */

let handle: DbHandle;
const db = () => handle.db;
const NOW = new Date("2026-11-16T03:00:00Z");
const FOLLOWED = "33333333-3333-4333-8333-333333333333";
const IGNORED = "44444444-4444-4444-8444-444444444444";
let followedId: string;
let counter = 0;
const newMbid = () => `55555555-5555-4555-8555-${String(++counter).padStart(12, "0")}`;

const day = (date: string): PartialDate => ({ date, precision: "day" });

/** A MusicBrainz stand-in: `dates` gives each group's date; `calls` counts the re-reads. */
function provider(dates: Map<string, PartialDate>) {
  const calls: string[] = [];
  const fake = {
    getReleaseGroup: async (mbid: string): Promise<ReleaseGroupDetail> => {
      calls.push(mbid);
      return {
        mbid,
        title: `Disque ${mbid.slice(-3)}`,
        type: "album",
        secondaryTypes: [],
        firstReleaseDate: dates.get(mbid) ?? null,
        artists: [
          {
            artist: {
              mbid: FOLLOWED,
              name: "Suivi",
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
      };
    },
    getCoverUrl: async () => null,
  };
  return { provider: fake as unknown as CatalogProvider, calls };
}

const fresh = (mbid: string, releaseDate: string, artist = FOLLOWED): FreshRelease => ({
  releaseGroupMbid: mbid,
  releaseMbid: null,
  title: "x",
  artistMbids: [artist],
  releaseDate,
  primaryType: "Album",
  secondaryType: null,
});

const listenBrainz = (releases: FreshRelease[] | Error): ListenBrainzClient => ({
  freshReleases: async () => {
    if (releases instanceof Error) throw releases;
    return releases;
  },
});

const row = async (mbid: string) =>
  (await db().select().from(schema.releases).where(eq(schema.releases.mbid, mbid)))[0];

/** A release of the followed artist already in the catalog. */
async function existing(mbid: string, date: string, complete: boolean) {
  const [r] = await db()
    .insert(schema.releases)
    .values({
      slug: `r-${randomUUID().slice(0, 8)}`,
      title: "Existing",
      type: "album",
      mbid,
      releaseDate: date,
      releaseDatePrecision: "day",
      announcedAt: NOW,
      tracklistImportedAt: complete ? NOW : null,
    })
    .returning();
  await db().insert(schema.releaseArtists).values({ releaseId: r!.id, artistId: followedId });
}

beforeAll(async () => {
  handle = await createTestDb();
  const [user] = await db()
    .insert(schema.user)
    .values({ name: "", email: "feed@example.test", emailVerified: true })
    .returning();
  const [artist] = await db()
    .insert(schema.artists)
    .values([
      { slug: "suivi", name: "Suivi", mbid: FOLLOWED },
      { slug: "ignore", name: "Ignoré", mbid: IGNORED },
    ])
    .returning();
  followedId = artist!.id;
  await db().insert(schema.artistFollows).values({ userId: user!.id, artistId: followedId });
}, 60_000);

afterAll(() => handle.close());

describe("runUpcomingFeed", () => {
  // First: no incomplete stub yet, so the budget goes to date checks only.
  it("checks an earlier ListenBrainz date before a later one", async () => {
    const [later, earlier] = [newMbid(), newMbid()];
    await existing(later, "2026-12-08", true);
    await existing(earlier, "2026-12-09", true);
    const mb = provider(new Map([[earlier, day("2026-12-09")]]));
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(later, "2026-12-15"), fresh(earlier, "2026-12-04")]),
      NOW,
      () => {},
      1,
    );
    expect(result).toMatchObject({ datesChecked: 1, skipped: 1 });
    expect(mb.calls).toEqual([earlier]);
  });

  it("imports the unknown groups of followed artists and ignores the others", async () => {
    const [mine, other] = [newMbid(), newMbid()];
    const mb = provider(new Map([[mine, day("2026-12-04")]]));
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(mine, "2026-12-04"), fresh(other, "2026-12-05", IGNORED)]),
      NOW,
    );
    expect(result).toMatchObject({ listenBrainz: "ok", matched: 1, imported: 1, failed: 0 });
    expect(mb.calls).toEqual([mine]);
    expect(await row(mine)).toMatchObject({ releaseDate: "2026-12-04", announcedAt: NOW });
    expect(await row(other)).toBeUndefined();
  });

  it("keeps the MusicBrainz date when ListenBrainz gives an earlier one", async () => {
    const mbid = newMbid();
    await existing(mbid, "2026-12-10", true);
    const mb = provider(new Map([[mbid, day("2026-12-10")]]));
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(mbid, "2026-12-03")]),
      NOW,
    );
    expect(result).toMatchObject({ datesChecked: 1 });
    expect(await row(mbid)).toMatchObject({
      releaseDate: "2026-12-10",
      releaseDateChangedAt: null,
    });
  });

  it("checks a later ListenBrainz date only after the stubs, within the budget", async () => {
    const [later, stub] = [newMbid(), newMbid()];
    await existing(later, "2026-12-09", true);
    await existing(stub, "2026-12-02", false);
    const mb = provider(new Map([[stub, day("2026-12-02")]]));
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(later, "2026-12-16")]),
      NOW,
      () => {},
      1,
    );
    expect(result).toMatchObject({ completed: 1, datesChecked: 0 });
    expect(mb.calls).toEqual([stub]);
  });

  it("applies a date MusicBrainz moved, and skips a group whose date already matches", async () => {
    const [moved, same] = [newMbid(), newMbid()];
    await existing(moved, "2026-12-11", true);
    await existing(same, "2026-12-12", true);
    const mb = provider(new Map([[moved, day("2027-01-08")]]));
    await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(moved, "2027-01-08"), fresh(same, "2026-12-12")]),
      NOW,
    );
    expect(mb.calls).toEqual([moved]);
    expect(await row(moved)).toMatchObject({
      releaseDate: "2027-01-08",
      releaseDateChangedAt: NOW,
    });
  });

  it("still completes upcoming stubs when ListenBrainz fails, within the budget", async () => {
    const stubs = [newMbid(), newMbid(), newMbid()];
    for (const [i, mbid] of stubs.entries()) await existing(mbid, `2026-12-2${i}`, false);
    const mb = provider(new Map(stubs.map((m, i) => [m, day(`2026-12-2${i}`)])));
    const logs: string[] = [];
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz(new CatalogError("unavailable", "ListenBrainz: HTTP 503.")),
      NOW,
      (line) => logs.push(line),
      2,
    );
    expect(result).toMatchObject({ listenBrainz: "failed", completed: 2, skipped: 1 });
    expect(mb.calls).toEqual(stubs.slice(0, 2));
    expect((await row(stubs[0]!))?.tracklistImportedAt).toEqual(NOW);
    expect((await row(stubs[2]!))?.tracklistImportedAt).toBeNull();
    expect(logs[0]).toContain("ListenBrainz failed");
  });

  it("spends a tight budget on a stub before a date check", async () => {
    const [dated, stub] = [newMbid(), newMbid()];
    await existing(dated, "2026-12-30", true);
    await existing(stub, "2026-12-01", false);
    const mb = provider(new Map([[stub, day("2026-12-01")]]));
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(dated, "2026-12-05")]),
      NOW,
      () => {},
      1,
    );
    expect(result).toMatchObject({ completed: 1, datesChecked: 0 });
    expect(mb.calls).toEqual([stub]);
  });

  it("counts a failed re-read and goes on with the next one", async () => {
    const [broken, fine] = [newMbid(), newMbid()];
    const mb = provider(new Map([[fine, day("2027-02-02")]]));
    const getReleaseGroup = mb.provider.getReleaseGroup.bind(mb.provider);
    mb.provider.getReleaseGroup = async (mbid: string) => {
      if (mbid === broken) throw new CatalogError("unavailable", "MusicBrainz: HTTP 503.");
      return getReleaseGroup(mbid);
    };
    const result = await runUpcomingFeed(
      db(),
      mb.provider,
      listenBrainz([fresh(broken, "2027-02-01"), fresh(fine, "2027-02-02")]),
      NOW,
    );
    expect(result).toMatchObject({ imported: 1, failed: 1 });
    expect(await row(fine)).toBeDefined();
  });
});
