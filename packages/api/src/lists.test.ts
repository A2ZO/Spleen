import { eq, schema, seed, sql, type DbHandle } from "@spleen/db";
import { fixtureId } from "@spleen/db/fixtures";
import { createTestDb } from "@spleen/db/testing";
import { LIST_ITEMS_MAX } from "@spleen/validators";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LIST_PAGE_SIZE } from "./lib/lists";
import { LISTS_PAGE_SIZE } from "./lib/profiles";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");

const nocturnes = fixtureId(201);
const leRoi = fixtureId(202);
const smokeRings = fixtureId(203);
const leRoiTrack = fixtureId(10_101);
const luneBasse = fixtureId(101);
const release = (id: string) => ({ kind: "release" as const, id });
const track = (id: string) => ({ kind: "track" as const, id });
const artist = (id: string) => ({ kind: "artist" as const, id });

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now });
}, 60_000);

afterAll(async () => {
  await handle.close();
});

const api = (user: SessionUser | null) =>
  createCaller(createContext({ now, db: () => handle.db, user: async () => user }));

let memberCount = 0;
async function member(options: { blindMode?: boolean } = {}) {
  memberCount += 1;
  const username = `lists${memberCount}`;
  const email = `${username}@example.test`;
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email, emailVerified: true })
    .returning();
  const user = { id: row!.id, email };
  await api(user).account.onboard({
    username,
    displayName: `Member ${memberCount}`,
    termsAccepted: true,
    locale: "fr",
    theme: "dark",
    timeZone: "Europe/Paris",
  });
  if (options.blindMode) {
    await handle.db
      .update(schema.profiles)
      .set({ blindMode: true })
      .where(eq(schema.profiles.userId, user.id));
  }
  return { user, username, call: () => api(user) };
}
type Member = Awaited<ReturnType<typeof member>>;

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof TRPCError)
      return error.message.startsWith("[") ? error.code : error.message;
    throw error;
  }
  throw new Error("expected an error");
}

const newList = (m: Member, title = "Pour la pluie", ranked = false) =>
  m.call().list.create({ title, description: "Des disques gris.", ranked });

const subject = (id: string) => ({ kind: "list" as const, id });

/** `n` new catalog tracks (the demo seed has fewer than a full list). */
async function manyTracks(n: number, prefix: string): Promise<string[]> {
  const rows = await handle.db
    .insert(schema.tracks)
    .values(Array.from({ length: n }, (_, i) => ({ slug: `${prefix}-${i}`, title: `Piste ${i}` })))
    .returning({ id: schema.tracks.id });
  return rows.map((r) => r.id);
}

describe("list writes", () => {
  it("create a list mixing releases, tracks and artists, in order", async () => {
    const m = await member();
    const { id } = await m.call().list.create({
      title: "  Nuits blanches  ",
      description: "Pour ne pas dormir.",
      ranked: true,
      item: release(nocturnes),
    });
    await m.call().list.addItem({ listId: id, target: track(leRoiTrack) });
    await m.call().list.addItem({ listId: id, target: artist(luneBasse) });

    const list = await api(null).list.byId({ id });
    expect(list).toMatchObject({
      title: "Nuits blanches",
      description: "Pour ne pas dormir.",
      ranked: true,
      owner: { username: m.username },
      isOwner: false,
      canLike: false,
      canComment: false,
    });
    expect(list!.items.items.map((i) => [i.position, i.kind])).toEqual([
      [1, "release"],
      [2, "track"],
      [3, "artist"],
    ]);
    const [first, second, third] = list!.items.items;
    expect(first?.kind === "release" && first.release.id).toBe(nocturnes);
    expect(second?.kind === "track" && second.track.id).toBe(leRoiTrack);
    expect(third?.kind === "artist" && third.artist.slug).toBe("lune-basse");
  });

  it("edit the title, description and ranking", async () => {
    const m = await member();
    const { id } = await newList(m);
    await m.call().list.update({ id, title: "Averses", description: "", ranked: true });
    expect(await api(null).list.byId({ id })).toMatchObject({
      title: "Averses",
      description: "",
      ranked: true,
    });
  });

  it("are refused on someone else's list, as if it did not exist", async () => {
    const [owner, other] = [await member(), await member()];
    const { id } = await newList(owner);
    const { itemId } = await owner.call().list.addItem({ listId: id, target: release(leRoi) });
    const calls = [
      () => other.call().list.update({ id, title: "Pirate", description: "", ranked: false }),
      () => other.call().list.addItem({ listId: id, target: release(nocturnes) }),
      () => other.call().list.removeItem({ listId: id, itemId }),
      () => other.call().list.reorder({ listId: id, itemIds: [itemId] }),
      () => other.call().list.delete({ id }),
    ];
    for (const call of calls) expect(await errorCode(call)).toBe("LIST_NOT_FOUND");
    expect((await api(null).list.byId({ id }))!.items.total).toBe(1);
  });

  it("need to be signed in, with a profile", async () => {
    expect(await errorCode(() => api(null).list.create({ title: "x" }))).toBe("UNAUTHENTICATED");
    const [row] = await handle.db
      .insert(schema.user)
      .values({ name: "", email: "lists-noprofile@example.test", emailVerified: true })
      .returning();
    const user = { id: row!.id, email: row!.email };
    expect(await errorCode(() => api(user).list.create({ title: "x" }))).toBe("PROFILE_REQUIRED");
  });

  it("refuse an item twice, an unknown item and a full list", async () => {
    const m = await member();
    const { id } = await newList(m);
    await m.call().list.addItem({ listId: id, target: release(nocturnes) });
    expect(
      await errorCode(() => m.call().list.addItem({ listId: id, target: release(nocturnes) })),
    ).toBe("LIST_ITEM_EXISTS");
    // The same id as another kind of item is a different item.
    expect(
      await errorCode(() => m.call().list.addItem({ listId: id, target: artist(nocturnes) })),
    ).toBe("ITEM_NOT_FOUND");

    const full = await newList(m, "Pleine");
    const trackIds = await manyTracks(LIST_ITEMS_MAX, "full");
    await handle.db
      .insert(schema.listItems)
      .values(trackIds.map((trackId, i) => ({ listId: full.id, trackId, position: i + 1 })));
    expect(
      await errorCode(() => m.call().list.addItem({ listId: full.id, target: release(leRoi) })),
    ).toBe("LIST_FULL");
  });

  it("reorder the same items only", async () => {
    const m = await member();
    const { id } = await newList(m, "Classement", true);
    const ids = [];
    for (const r of [nocturnes, leRoi, smokeRings]) {
      ids.push((await m.call().list.addItem({ listId: id, target: release(r) })).itemId);
    }
    await m.call().list.reorder({ listId: id, itemIds: [ids[2]!, ids[0]!, ids[1]!] });
    const order = (await api(null).list.byId({ id }))!.items.items.map((i) => i.id);
    expect(order).toEqual([ids[2], ids[0], ids[1]]);

    for (const itemIds of [
      [ids[0]!, ids[1]!],
      [...ids, ids[0]!],
      [ids[0]!, ids[1]!, ids[1]!],
    ]) {
      expect(await errorCode(() => m.call().list.reorder({ listId: id, itemIds }))).toBe(
        "LIST_MISMATCH",
      );
    }
  });

  it("remove an item and number the rest without gaps", async () => {
    const m = await member();
    const { id } = await newList(m, "Trois", true);
    const added = [];
    for (const r of [nocturnes, leRoi, smokeRings]) {
      added.push((await m.call().list.addItem({ listId: id, target: release(r) })).itemId);
    }
    await m.call().list.removeItem({ listId: id, itemId: added[1]! });
    await m.call().list.removeItem({ listId: id, itemId: added[1]! }); // already gone: no-op
    const items = (await api(null).list.byId({ id }))!.items.items;
    expect(items.map((i) => [i.position, i.id])).toEqual([
      [1, added[0]],
      [2, added[2]],
    ]);
  });

  it("delete the list with its likes, comments and notifications", async () => {
    const [owner, fan] = [await member(), await member()];
    const { id } = await newList(owner);
    await fan.call().like.set({ subject: subject(id), liked: true });
    await fan.call().comment.create({ subject: subject(id), body: "Superbe." });
    await owner.call().list.delete({ id });
    expect(await api(null).list.byId({ id })).toBeNull();
    const where = sql`list_id = ${id}`;
    expect(await handle.db.$count(schema.likes, where)).toBe(0);
    expect(await handle.db.$count(schema.comments, where)).toBe(0);
    expect(await handle.db.$count(schema.notifications, where)).toBe(0);
  });

  it("are rate limited per member", async () => {
    const m = await member();
    await handle.db
      .insert(schema.rateLimits)
      .values({ key: `list-write:${m.user.id}`, count: 120, windowStart: new Date() });
    expect(await errorCode(() => newList(m))).toBe("RATE_LIMITED");
  });
});

describe("list pages", () => {
  it("page the items, numbered across pages", async () => {
    const m = await member();
    const { id } = await newList(m, "Longue", true);
    const trackIds = await manyTracks(LIST_PAGE_SIZE + 3, "long");
    await handle.db
      .insert(schema.listItems)
      .values(trackIds.map((trackId, i) => ({ listId: id, trackId, position: i + 1 })));
    const second = (await api(null).list.byId({ id, page: 2 }))!.items;
    expect(second).toMatchObject({ page: 2, pageCount: 2, total: LIST_PAGE_SIZE + 3 });
    expect(second.items.map((i) => i.position)).toEqual([51, 52, 53]);
  });

  it("let members like and comment, not the owner like their own list", async () => {
    const [owner, fan] = [await member(), await member()];
    const { id } = await newList(owner);
    expect(await fan.call().list.byId({ id })).toMatchObject({ canLike: true, canComment: true });
    expect(await owner.call().list.byId({ id })).toMatchObject({
      isOwner: true,
      canLike: false,
      canComment: true,
    });
    await fan.call().like.set({ subject: subject(id), liked: true });
    await fan.call().comment.create({ subject: subject(id), body: "Belle sélection." });
    expect(await fan.call().list.byId({ id })).toMatchObject({
      likeCount: 1,
      commentCount: 1,
      viewerLiked: true,
    });
    expect(
      await errorCode(() => owner.call().like.set({ subject: subject(id), liked: true })),
    ).toBe("SELF_ACTION");
  });

  it("follow blocks: no interaction, blocked members' comments hidden from the count", async () => {
    const [owner, blocked, reader] = [await member(), await member(), await member()];
    const { id } = await newList(owner);
    await blocked.call().comment.create({ subject: subject(id), body: "Avant le blocage." });
    await reader.call().comment.create({ subject: subject(id), body: "Joli." });
    await reader.call().block.add({ username: blocked.username });
    await owner.call().block.add({ username: blocked.username });

    expect(await blocked.call().list.byId({ id })).toMatchObject({
      canLike: false,
      canComment: false,
    });
    expect(
      await errorCode(() => blocked.call().like.set({ subject: subject(id), liked: true })),
    ).toBe("ACTION_UNAVAILABLE");
    // The reader blocked the commenter; the owner still sees it to be able to delete it.
    expect((await reader.call().list.byId({ id }))!.commentCount).toBe(1);
    expect((await owner.call().list.byId({ id }))!.commentCount).toBe(2);
    expect((await api(null).list.byId({ id }))!.commentCount).toBe(2);
  });

  it("hide community ratings from a blind viewer until they rate", async () => {
    const [owner, blind] = [await member(), await member({ blindMode: true })];
    const { id } = await newList(owner);
    await owner.call().list.addItem({ listId: id, target: release(nocturnes) });
    await owner.call().list.addItem({ listId: id, target: track(leRoiTrack) });
    const cards = async () => {
      const [first, second] = (await blind.call().list.byId({ id }))!.items.items;
      return [
        first?.kind === "release" ? first.release : null,
        second?.kind === "track" ? second.track.release : null,
      ];
    };
    for (const card of await cards()) {
      expect(card).toMatchObject({ averageRating: null, ratingsHidden: true });
    }
    await blind.call().listening.quickRate({ target: release(nocturnes), rating: 8 });
    const [rated] = await cards();
    expect(rated!.ratingsHidden).toBeUndefined();
    expect(rated!.averageRating).not.toBeNull();
    // A sighted visitor sees them.
    const [visible] = (await api(null).list.byId({ id }))!.items.items;
    expect(visible?.kind === "release" && visible.release.averageRating).not.toBeNull();
  });

  it("tell the caller which of their lists hold an item", async () => {
    const m = await member();
    const [a, b] = [await newList(m, "A"), await newList(m, "B")];
    const { itemId } = await m.call().list.addItem({ listId: b.id, target: artist(luneBasse) });
    const mine = await m.call().list.mine({ target: artist(luneBasse) });
    expect(mine.map((l) => [l.title, l.itemId, l.itemCount])).toEqual([
      ["B", itemId, 1],
      ["A", null, 0],
    ]);
    expect(a.id).not.toBe(b.id);
  });

  it("page the profile's lists, last edited first", async () => {
    const m = await member();
    for (let i = 0; i < LISTS_PAGE_SIZE + 1; i += 1) await newList(m, `Liste ${i}`);
    const first = await api(null).profile.lists({ username: m.username, page: 1 });
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: LISTS_PAGE_SIZE + 1 });
    expect(first!.items[0]!.title).toBe(`Liste ${LISTS_PAGE_SIZE}`);
  });
});

describe("list reports", () => {
  it("let members report someone else's list, not their own", async () => {
    const [owner, reader] = [await member(), await member()];
    const { id } = await newList(owner);
    await reader.call().report.create({ subject: { kind: "list", id }, reason: "spam" });
    expect(await handle.db.$count(schema.reports, sql`list_id = ${id}`)).toBe(1);
    expect(
      await errorCode(() =>
        owner.call().report.create({ subject: { kind: "list", id }, reason: "spam" }),
      ),
    ).toBe("SELF_ACTION");
  });
});

describe("album page", () => {
  it("leaves out the reviews and lists of members blocked either way, and their comments", async () => {
    const [reader, author, blocked] = [await member(), await member(), await member()];
    const write = (m: Member, body: string) =>
      m.call().review.create({ target: release(smokeRings), body, lang: "fr" });
    const review = await write(author, "Un disque de fin de nuit.");
    await write(blocked, "Bof.");
    const list = await newList(blocked, "Liste bloquée");
    await blocked.call().list.addItem({ listId: list.id, target: release(smokeRings) });
    await blocked.call().comment.create({
      subject: { kind: "review", id: review.id },
      body: "Je ne suis pas d'accord.",
    });
    await reader.call().block.add({ username: blocked.username });

    const slug = "smoke-rings-at-1-am";
    const seen = (await reader.call().release.bySlug({ slug }))!;
    expect(seen.reviews.map((r) => r.author.username)).not.toContain(blocked.username);
    expect(seen.lists.map((l) => l.id)).not.toContain(list.id);
    expect(seen.reviews.find((r) => r.id === review.id)!.commentCount).toBe(0);

    const guest = (await api(null).release.bySlug({ slug }))!;
    expect(guest.reviews.map((r) => r.author.username)).toContain(blocked.username);
    expect(guest.lists.map((l) => l.id)).toContain(list.id);
    expect(guest.reviews.find((r) => r.id === review.id)!.commentCount).toBe(1);
  });
});
