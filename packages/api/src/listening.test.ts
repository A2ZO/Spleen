import { and, eq, recomputeItemState, schema, seed, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { fixtureId } from "@spleen/db/fixtures";
import { suggestAlbumRating, todayIn } from "@spleen/validators";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");

const nocturnes = fixtureId(201);
const leRoi = fixtureId(202);
/** Track n of "Nocturnes pour pluie fine" (seed ids). */
const nocturnesTrack = (n: number) => fixtureId(10_000 + n);
const leRoiTrack = (n: number) => fixtureId(10_100 + n);
const album = { kind: "release" as const, id: nocturnes };

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db);
}, 60_000);

afterAll(async () => {
  await handle.close();
});

function api(user: SessionUser | null, at = now) {
  return createCaller(createContext({ now: at, db: () => handle.db, user: async () => user }));
}

let memberCount = 0;
async function member(options: { timeZone?: string; blindMode?: boolean } = {}) {
  memberCount += 1;
  const username = `listener${memberCount}`;
  const email = `${username}@example.test`;
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email, emailVerified: true })
    .returning();
  const user = { id: row!.id, email };
  await api(user).account.onboard({
    username,
    displayName: username,
    termsAccepted: true,
    locale: "fr",
    theme: "dark",
    timeZone: options.timeZone ?? "Europe/Paris",
  });
  if (options.blindMode) {
    await handle.db
      .update(schema.profiles)
      .set({ blindMode: true })
      .where(eq(schema.profiles.userId, user.id));
  }
  return { user, username, call: (at = now) => api(user, at) };
}

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof TRPCError) return error.message;
    throw error;
  }
  throw new Error("expected an error");
}

const entriesOf = (userId: string) =>
  handle.db.select().from(schema.entries).where(eq(schema.entries.userId, userId));

async function stateOf(userId: string, target: { releaseId: string } | { trackId: string }) {
  const s = schema.userItemState;
  const [row] = await handle.db
    .select()
    .from(s)
    .where(
      and(
        eq(s.userId, userId),
        "releaseId" in target ? eq(s.releaseId, target.releaseId) : eq(s.trackId, target.trackId),
      ),
    );
  return row ?? null;
}

/** The stored state must equal a fresh derivation from the listens. */
async function expectConsistent(
  userId: string,
  target: { releaseId: string } | { trackId: string },
) {
  const stored = await stateOf(userId, target);
  await handle.db.transaction((tx) => recomputeItemState(tx, userId, target));
  const fresh = await stateOf(userId, target);
  const pick = (r: typeof stored) =>
    r && { rating: r.rating, liked: r.liked, listened: r.listened, wantToListen: r.wantToListen };
  expect(pick(stored)).toEqual(pick(fresh));
}

describe("today in the member's time zone", () => {
  const lateEvening = new Date("2026-10-21T23:30:00Z");

  it("is computed in the zone, not on the server", () => {
    expect(todayIn("Europe/Paris", lateEvening)).toBe("2026-10-22");
    expect(todayIn("America/Los_Angeles", lateEvening)).toBe("2026-10-21");
  });

  it("dates a one-click listen", async () => {
    const paris = await member({ timeZone: "Europe/Paris" });
    const la = await member({ timeZone: "America/Los_Angeles" });
    await paris.call(lateEvening).listening.markListened(album);
    await la.call(lateEvening).listening.markListened(album);
    expect((await entriesOf(paris.user.id))[0]?.listenedOn).toBe("2026-10-22");
    expect((await entriesOf(la.user.id))[0]?.listenedOn).toBe("2026-10-21");
    expect((await la.call(lateEvening).listening.myState(album))?.today).toBe("2026-10-21");
  });

  it("refuses a date in the future", async () => {
    const m = await member({ timeZone: "America/Los_Angeles" });
    const create = m.call(new Date("2026-10-21T23:30:00Z")).listening.entry.create;
    const base = { target: album, rating: null, liked: false, relisten: false, format: null };
    const input = { ...base, moodIds: [], trackRatings: [] };
    expect(await errorCode(() => create({ ...input, listenedOn: "2026-10-22" }))).toBe(
      "DATE_IN_FUTURE",
    );
    await create({ ...input, listenedOn: "2026-10-21" });
  });
});

describe("listens and member state", () => {
  const form = {
    target: album,
    rating: null,
    liked: false,
    relisten: false,
    format: null,
    moodIds: [],
    trackRatings: [],
  };

  it("one-click listen: dated today, listened, removed from the queue", async () => {
    const m = await member();
    await m.call().listening.setWantToListen({ target: album, wantToListen: true });
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      wantToListen: true,
      listened: false,
    });
    await m.call().listening.markListened(album);
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      wantToListen: false,
      listened: true,
      rating: null,
    });
    const [entry] = await entriesOf(m.user.id);
    expect(entry).toMatchObject({ listenedOn: "2026-10-21", isRelisten: false });
    await m.call().listening.markListened(album);
    expect((await entriesOf(m.user.id)).filter((e) => e.isRelisten)).toHaveLength(1);
  });

  it("deleting the last listen deletes the state", async () => {
    const m = await member();
    const { id } = await m.call().listening.entry.create({ ...form, rating: 6 });
    expect((await stateOf(m.user.id, { releaseId: nocturnes }))?.rating).toBe(6);
    await m.call().listening.entry.delete({ id });
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toBeNull();
  });

  it("keeps the queue when the last listen is deleted after re-queueing", async () => {
    const m = await member();
    const { id } = await m.call().listening.entry.create(form);
    await m.call().listening.setWantToListen({ target: album, wantToListen: true });
    await m.call().listening.entry.delete({ id });
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      wantToListen: true,
      listened: false,
    });
  });

  it("only touches the member's own listens", async () => {
    const owner = await member();
    const other = await member();
    const { id } = await owner.call().listening.entry.create(form);
    expect(await errorCode(() => other.call().listening.entry.delete({ id }))).toBe(
      "ENTRY_NOT_FOUND",
    );
  });

  it("a dated listen keeps its date", async () => {
    const m = await member();
    const { id } = await m.call().listening.entry.create(form);
    const update = { ...form, id, listenedOn: null };
    expect(await errorCode(() => m.call().listening.entry.update(update))).toBe("DATE_REQUIRED");
  });
});

describe("undated listens (quick rating and heart)", () => {
  it("a quick rating creates one undated listen, then updates it", async () => {
    const m = await member();
    await m.call().listening.quickRate({ target: album, rating: 6 });
    await m.call().listening.quickRate({ target: album, rating: 8 });
    const rows = await entriesOf(m.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ listenedOn: null, rating: 8 });
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      rating: 8,
      listened: true,
    });
    await expectConsistent(m.user.id, { releaseId: nocturnes });
  });

  it("ignores a quick rating older than the last one applied from the same panel", async () => {
    const m = await member();
    const clientId = crypto.randomUUID();
    const rate = (rating: number | null, seq: number, id = clientId) =>
      m.call().listening.quickRate({ target: album, rating, order: { clientId: id, seq } });
    // Clicks 4.5 then clears, but the clearing request reaches the server first.
    await rate(null, 2);
    await rate(9, 1);
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toBeNull();
    expect(await entriesOf(m.user.id)).toHaveLength(0);

    await rate(10, 3);
    await rate(8, 3); // a replayed number is stale too
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({ rating: 10 });
    // Another panel (a reload, another tab) starts its own numbering: last write wins.
    await rate(6, 1, crypto.randomUUID());
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({ rating: 6 });
  });

  it("applies concurrent quick ratings in their order", async () => {
    const m = await member();
    const clientId = crypto.randomUUID();
    await Promise.all(
      [3, 1, 4, 2].map((seq) =>
        m.call().listening.quickRate({ target: album, rating: seq * 2, order: { clientId, seq } }),
      ),
    );
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({ rating: 8 });
    await expectConsistent(m.user.id, { releaseId: nocturnes });
  });

  it("a heart updates the same undated listen without changing the rating", async () => {
    const m = await member();
    await m.call().listening.quickRate({ target: album, rating: 7 });
    await m.call().listening.quickLike({ target: album, liked: true });
    const rows = await entriesOf(m.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: 7, liked: true });
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      rating: 7,
      liked: true,
    });
  });

  it("re-rating quickly a disc already rated in the diary changes the current rating", async () => {
    const m = await member();
    const create = m.call().listening.entry.create;
    const { id } = await create({
      target: album,
      listenedOn: "2026-03-01",
      rating: 6,
      liked: false,
      relisten: false,
      format: "vinyl",
      moodIds: [],
      trackRatings: [],
    });
    await m.call().listening.quickRate({ target: album, rating: 9 });
    expect((await stateOf(m.user.id, { releaseId: nocturnes }))?.rating).toBe(9);

    // Editing the old dated listen makes it the most recently modified one again.
    await m.call().listening.entry.update({
      id,
      listenedOn: "2026-03-01",
      rating: 5,
      liked: false,
      relisten: false,
      format: "vinyl",
      moodIds: [],
      trackRatings: [],
    });
    expect((await stateOf(m.user.id, { releaseId: nocturnes }))?.rating).toBe(5);
    await expectConsistent(m.user.id, { releaseId: nocturnes });
  });

  it("removing the quick rating deletes the empty undated listen", async () => {
    const m = await member();
    await m.call().listening.quickRate({ target: album, rating: 8 });
    await m.call().listening.quickRate({ target: album, rating: null });
    expect(await entriesOf(m.user.id)).toHaveLength(0);
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toBeNull();
  });

  it("removing the quick rating keeps the undated listen when it still has a heart", async () => {
    const m = await member();
    await m.call().listening.quickRate({ target: album, rating: 8 });
    await m.call().listening.quickLike({ target: album, liked: true });
    await m.call().listening.quickRate({ target: album, rating: null });
    const rows = await entriesOf(m.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rating: null, liked: true });
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      rating: null,
      liked: true,
    });
  });

  it("removing the quick rating keeps the undated listen when a review is attached", async () => {
    const m = await member();
    await m.call().listening.quickRate({ target: album, rating: 8 });
    const [undated] = await entriesOf(m.user.id);
    const review = await m.call().review.create({
      target: album,
      body: "La contrebasse, surtout.",
      lang: "fr",
      entryId: undated!.id,
    });
    await m.call().listening.quickRate({ target: album, rating: null });
    expect(await entriesOf(m.user.id)).toHaveLength(1);
    const [snapshot] = await handle.db
      .select({ rating: schema.reviews.rating })
      .from(schema.reviews)
      .where(eq(schema.reviews.id, review.id));
    expect(snapshot?.rating).toBeNull();

    // Without the review, nothing is left on it: it goes.
    await m.call().review.delete({ id: review.id });
    expect(await entriesOf(m.user.id)).toHaveLength(0);
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toBeNull();
  });

  it("removing the quick rating falls back to the diary's latest rating", async () => {
    const m = await member();
    await m.call().listening.entry.create({
      target: album,
      listenedOn: "2026-03-01",
      rating: 6,
      liked: false,
      relisten: false,
      format: null,
      moodIds: [],
      trackRatings: [],
    });
    await m.call().listening.quickRate({ target: album, rating: 9 });
    await m.call().listening.quickRate({ target: album, rating: null });
    expect((await stateOf(m.user.id, { releaseId: nocturnes }))?.rating).toBe(6);
  });

  it("removing the heart from the page removes it from every listen", async () => {
    const m = await member();
    await m.call().listening.entry.create({
      target: album,
      listenedOn: "2026-03-01",
      rating: 6,
      liked: true,
      relisten: false,
      format: null,
      moodIds: [],
      trackRatings: [],
    });
    await m.call().listening.quickLike({ target: album, liked: false });
    expect((await entriesOf(m.user.id)).every((e) => !e.liked)).toBe(true);
    expect(await stateOf(m.user.id, { releaseId: nocturnes })).toMatchObject({
      liked: false,
      rating: 6,
    });
    await expectConsistent(m.user.id, { releaseId: nocturnes });
  });

  it("giving a date to an undated listen puts it in the diary", async () => {
    const m = await member();
    await m.call().listening.quickRate({ target: album, rating: 8 });
    const diary = () => m.call().profile.diary({ username: m.username, page: 1 });
    expect((await diary())?.items).toHaveLength(0);
    const [undated] = await entriesOf(m.user.id);
    await m.call().listening.entry.update({
      id: undated!.id,
      listenedOn: "2026-10-20",
      rating: 8,
      liked: false,
      relisten: false,
      format: "streaming",
      moodIds: [],
      trackRatings: [],
    });
    expect((await diary())?.items.map((d) => d.listenedOn)).toEqual(["2026-10-20"]);
  });
});

describe("track-by-track ratings", () => {
  const base = {
    target: album,
    listenedOn: "2026-10-20",
    liked: false,
    relisten: false,
    format: null,
    moodIds: [],
  };

  it("suggests an album rating rounded to the half star", () => {
    expect(suggestAlbumRating([])).toBeNull();
    expect(suggestAlbumRating([8, 9])).toBe(9);
    expect(suggestAlbumRating([7, 8, 8])).toBe(8);
  });

  it("never imposes the album rating and feeds the track states", async () => {
    const m = await member();
    const { id } = await m.call().listening.entry.create({
      ...base,
      rating: null,
      trackRatings: [
        { trackId: nocturnesTrack(1), rating: 9 },
        { trackId: nocturnesTrack(2), rating: 10 },
      ],
    });
    expect((await stateOf(m.user.id, { releaseId: nocturnes }))?.rating).toBeNull();
    expect((await stateOf(m.user.id, { trackId: nocturnesTrack(2) }))?.rating).toBe(10);
    const mine = await m.call().listening.myState(album);
    expect(mine?.entries[0]?.trackRatings).toHaveLength(2);

    // Removing a track rating removes that track's state.
    await m.call().listening.entry.update({
      ...base,
      id,
      rating: 8,
      trackRatings: [{ trackId: nocturnesTrack(1), rating: 9 }],
    });
    expect(await stateOf(m.user.id, { trackId: nocturnesTrack(2) })).toBeNull();
    expect((await stateOf(m.user.id, { releaseId: nocturnes }))?.rating).toBe(8);
    await expectConsistent(m.user.id, { trackId: nocturnesTrack(1) });
  });

  it("refuses tracks from another release", async () => {
    const m = await member();
    const input = { ...base, rating: null, trackRatings: [{ trackId: leRoiTrack(1), rating: 6 }] };
    expect(await errorCode(() => m.call().listening.entry.create(input))).toBe(
      "TRACK_NOT_ON_RELEASE",
    );
  });
});

describe("reviews", () => {
  it("can be written without a rating, and a rating without a review", async () => {
    const m = await member();
    await m.call().review.create({ target: album, body: "Je n'ose pas noter.", lang: "fr" });
    const [review] = await handle.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.userId, m.user.id));
    expect(review?.rating).toBeNull();
    expect(await entriesOf(m.user.id)).toHaveLength(0);

    await m.call().listening.quickRate({ target: { kind: "release", id: leRoi }, rating: 7 });
    expect(
      await handle.db.$count(
        schema.reviews,
        and(eq(schema.reviews.userId, m.user.id), eq(schema.reviews.releaseId, leRoi)),
      ),
    ).toBe(0);
  });

  it("written with a listen, shows its rating and follows its edits", async () => {
    const m = await member();
    const { id } = await m.call().listening.entry.create({
      target: album,
      rating: 7,
      liked: false,
      relisten: false,
      format: null,
      moodIds: [],
      trackRatings: [],
      review: { body: "Une heure du matin, toujours.", lang: "fr" },
    });
    const reviewRating = async () =>
      (
        await handle.db
          .select({ rating: schema.reviews.rating })
          .from(schema.reviews)
          .where(eq(schema.reviews.entryId, id))
      )[0]?.rating;
    expect(await reviewRating()).toBe(7);
    await m.call().listening.entry.update({
      id,
      listenedOn: "2026-10-21",
      rating: 9,
      liked: false,
      relisten: false,
      format: null,
      moodIds: [],
      trackRatings: [],
    });
    expect(await reviewRating()).toBe(9);
  });
});

describe("moods", () => {
  it("lists suggested moods and the member's own", async () => {
    const m = await member();
    const mood = await m.call().listening.moods.create({ label: "Sous la couette" });
    expect(mood).toMatchObject({ slug: "sous-la-couette", personal: true });
    const list = await m.call().listening.moods.list();
    expect(list.filter((x) => !x.personal)).toHaveLength(20);
    expect(list.at(-1)?.id).toBe(mood.id);
    expect((await api(null).listening.moods.list()).some((x) => x.personal)).toBe(false);
  });

  it("refuses someone else's personal mood", async () => {
    const owner = await member();
    const other = await member();
    const mood = await owner.call().listening.moods.create({ label: "Mon secret" });
    const input = {
      target: album,
      rating: null,
      liked: false,
      relisten: false,
      format: null,
      moodIds: [mood.id],
      trackRatings: [],
    };
    expect(await errorCode(() => other.call().listening.entry.create(input))).toBe(
      "MOOD_NOT_FOUND",
    );
    const { id } = await owner.call().listening.entry.create(input);
    const mine = await owner.call().listening.myState(album);
    expect(mine?.entries.find((e) => e.id === id)?.moodIds).toEqual([mood.id]);
  });

  it("caps personal moods", async () => {
    const m = await member();
    await handle.db.insert(schema.moods).values(
      Array.from({ length: 50 }, (_, i) => ({
        slug: `mood-${i}`,
        ownerId: m.user.id,
        labelFr: `Humeur ${i}`,
        labelEn: `Humeur ${i}`,
      })),
    );
    expect(await errorCode(() => m.call().listening.moods.create({ label: "Encore une" }))).toBe(
      "MOOD_LIMIT",
    );
  });
});

describe("rate limits", () => {
  it("blocks listening writes beyond the hourly budget", async () => {
    const m = await member();
    await handle.db
      .insert(schema.rateLimits)
      .values({ key: `listen-write:${m.user.id}`, count: 300, windowStart: new Date() });
    expect(await errorCode(() => m.call().listening.markListened(album))).toBe("RATE_LIMITED");
  });

  it("blocks reviews beyond their own budget", async () => {
    const m = await member();
    await handle.db
      .insert(schema.rateLimits)
      .values({ key: `review-write:${m.user.id}`, count: 30, windowStart: new Date() });
    const create = () => m.call().review.create({ target: album, body: "Encore.", lang: "fr" });
    expect(await errorCode(create)).toBe("RATE_LIMITED");
  });

  it("requires being signed in", async () => {
    expect(await errorCode(() => api(null).listening.markListened(album))).toBe("UNAUTHENTICATED");
  });
});

describe("blind listening", () => {
  it("hides the community ratings until the member has rated", async () => {
    const m = await member({ blindMode: true });
    const before = await m.call().release.bySlug({ slug: "nocturnes-pour-pluie-fine" });
    expect(before).toMatchObject({ averageRating: null, ratingCount: 0, ratingsHidden: true });
    expect(before?.ratingDistribution.every((n) => n === 0)).toBe(true);
    expect(before?.reviews.every((r) => r.rating === null)).toBe(true);

    await m.call().listening.quickRate({ target: album, rating: 8 });
    const after = await m.call().release.bySlug({ slug: "nocturnes-pour-pluie-fine" });
    expect(after?.ratingsHidden).toBeUndefined();
    expect(after?.averageRating).not.toBeNull();
  });

  it("changes nothing for other members and visitors", async () => {
    const page = await api(null).release.bySlug({ slug: "nocturnes-pour-pluie-fine" });
    expect(page?.averageRating).not.toBeNull();
    const search = await api(null).catalog.search({ q: "nocturnes", type: "all" });
    expect(search.releases[0]?.ratingsHidden).toBeUndefined();
  });

  it("applies to search results too", async () => {
    const m = await member({ blindMode: true });
    const search = await m.call().catalog.search({ q: "nocturnes", type: "all" });
    expect(search.releases[0]).toMatchObject({ averageRating: null, ratingsHidden: true });
  });
});

describe("private diary", () => {
  it("hides the diary and queue from others, not from the member", async () => {
    const m = await member();
    await m.call().listening.markListened(album);
    await m.call().listening.setWantToListen({
      target: { kind: "release", id: leRoi },
      wantToListen: true,
    });
    await handle.db
      .update(schema.profiles)
      .set({ diaryPrivate: true })
      .where(eq(schema.profiles.userId, m.user.id));

    const username = m.username;
    const page = { username, page: 1 };
    const others = api(null).profile;
    expect(await others.byUsername({ username })).toMatchObject({ diaryHidden: true, recent: [] });
    expect((await others.diary(page))?.items).toEqual([]);
    expect((await others.toListen(page))?.items).toEqual([]);
    const owner = m.call().profile;
    expect((await owner.byUsername({ username }))?.diaryHidden).toBe(false);
    expect((await owner.diary(page))?.items).toHaveLength(1);
    expect((await owner.toListen(page))?.items.map((r) => r.id)).toEqual([leRoi]);
  });
});

describe("demo members", () => {
  it("read their activity from the database", async () => {
    const page = { username: "nuitblanche", page: 1 };
    const profile = api(null).profile;
    const diary = await profile.diary(page);
    expect(diary?.items[0]).toMatchObject({ listenedOn: "2026-10-18" });
    const withMoods = diary?.items.find((d) => d.moods.length > 0);
    expect(withMoods?.moods.map((x) => x.slug)).toEqual(["rain", "night"]);
    expect((await profile.reviews(page))?.total).toBeGreaterThan(0);
    expect((await profile.toListen(page))?.items.map((r) => r.slug)).toEqual([
      "gold-leaf-sessions",
    ]);
  });
});
