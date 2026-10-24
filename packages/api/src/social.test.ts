import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDb, eq, schema, seed, sql, type DbHandle } from "@spleen/db";
import { fixtureId } from "@spleen/db/fixtures";
import { createLocalStorage } from "@spleen/infra/storage";
import { COMMENT_BODY_MAX } from "@spleen/validators";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { COMMENTS_PAGE_SIZE } from "./lib/social/interactions";
import { FEED_PAGE_SIZE } from "./lib/social/feed";
import { FOLLOWS_PAGE_SIZE } from "./lib/social/follows";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const minutesLater = (n: number) => new Date(now.getTime() + n * 60 * 1000);

const nocturnes = fixtureId(201);
const leRoi = fixtureId(202);
const smokeRings = fixtureId(203);
const leRoiTrack = fixtureId(10_101);
const release = (id: string) => ({ kind: "release" as const, id });

beforeAll(async () => {
  handle = createDb("memory://");
  await handle.migrate();
  await seed(handle.db, { now });
}, 60_000);

afterAll(async () => {
  await handle.close();
  rmSync(uploadsDir, { recursive: true, force: true });
});

const uploadsDir = mkdtempSync(path.join(tmpdir(), "spleen-social-"));
const storage = () => createLocalStorage({ dir: uploadsDir });

function api(user: SessionUser | null, at = now) {
  return createCaller(
    createContext({ now: at, db: () => handle.db, user: async () => user, storage }),
  );
}

let memberCount = 0;
async function member(options: { diaryPrivate?: boolean; blindMode?: boolean } = {}) {
  memberCount += 1;
  const username = `social${memberCount}`;
  const email = `${username}@example.test`;
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email, emailVerified: true })
    .returning();
  const user = { id: row!.id, email };
  await api(user).account.onboard({
    username,
    displayName: `Member ${memberCount}`,
    ageConfirmed: true,
    locale: "fr",
    theme: "dark",
    timeZone: "Europe/Paris",
  });
  if (options.diaryPrivate || options.blindMode) {
    await handle.db
      .update(schema.profiles)
      .set({ diaryPrivate: options.diaryPrivate ?? false, blindMode: options.blindMode ?? false })
      .where(eq(schema.profiles.userId, user.id));
  }
  return { user, username, call: (at = now) => api(user, at) };
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

const listen = (
  target: { kind: "release" | "track"; id: string },
  listenedOn: string,
  rating: number | null = null,
) => ({
  target,
  listenedOn,
  rating,
  liked: false,
  relisten: false,
  format: null,
  moodIds: [],
  trackRatings: [],
});

async function review(m: Member, options: { target?: string; lang?: "fr" | "en"; at?: Date } = {}) {
  return m.call(options.at).review.create({
    target: release(options.target ?? nocturnes),
    body: "Un disque de pluie.",
    lang: options.lang ?? "fr",
  });
}

const reviewSubject = (id: string) => ({ kind: "review" as const, id });

describe("following", () => {
  it("follows and unfollows, notifies once, and lists followers newest first", async () => {
    const [a, b] = [await member(), await member()];
    await a.call().social.follow({ username: b.username });
    await a.call(minutesLater(1)).social.follow({ username: b.username }); // again: no change
    const profile = await a.call().profile.byUsername({ username: b.username });
    expect(profile).toMatchObject({ followerCount: 1, viewerFollows: true, canInteract: true });

    const notes = await b.call().notification.list({});
    expect(notes.items).toHaveLength(1);
    expect(notes.items[0]).toMatchObject({ type: "follow", actorCount: 1 });
    expect(notes.items[0]!.actors[0]!.username).toBe(a.username);

    await a.call().social.unfollow({ username: b.username });
    expect((await b.call().notification.list({})).items).toHaveLength(0);
    expect((await api(null).profile.byUsername({ username: b.username }))?.followerCount).toBe(0);
  });

  it("pages followers and following with a cursor", async () => {
    const star = await member();
    const fans: Member[] = [];
    for (let i = 0; i < FOLLOWS_PAGE_SIZE + 2; i++) {
      const fan = await member();
      await fan.call(minutesLater(i)).social.follow({ username: star.username });
      fans.push(fan);
    }
    const first = await api(null).social.followers({ username: star.username });
    expect(first?.items).toHaveLength(FOLLOWS_PAGE_SIZE);
    expect(first?.items[0]?.username).toBe(fans.at(-1)!.username);
    const second = await api(null).social.followers({
      username: star.username,
      cursor: first!.nextCursor!,
    });
    expect(second?.items.map((m) => m.username)).toEqual([fans[1]!.username, fans[0]!.username]);
    expect(second?.nextCursor).toBeNull();

    const following = await fans[0]!.call().social.following({ username: fans[0]!.username });
    expect(following?.items).toEqual([
      expect.objectContaining({ username: star.username, viewerFollows: true }),
    ]);
  });

  it("refuses a forged cursor", async () => {
    const m = await member();
    expect(
      await errorCode(() => api(null).social.followers({ username: m.username, cursor: "bm9wZQ" })),
    ).toBe("INVALID_CURSOR");
  });
});

describe("acting on oneself", () => {
  it("cannot follow, block, report oneself or like one's own review", async () => {
    const m = await member();
    const own = await review(m);
    expect(await errorCode(() => m.call().social.follow({ username: m.username }))).toBe(
      "SELF_ACTION",
    );
    expect(await errorCode(() => m.call().block.add({ username: m.username }))).toBe("SELF_ACTION");
    expect(
      await errorCode(() =>
        m
          .call()
          .report.create({ subject: { kind: "member", username: m.username }, reason: "spam" }),
      ),
    ).toBe("SELF_ACTION");
    expect(
      await errorCode(() =>
        m.call().report.create({ subject: { kind: "review", id: own.id }, reason: "spam" }),
      ),
    ).toBe("SELF_ACTION");
    expect(
      await errorCode(() => m.call().like.set({ subject: reviewSubject(own.id), liked: true })),
    ).toBe("SELF_ACTION");
    // Authors may still answer under their own review.
    await m.call().comment.create({ subject: reviewSubject(own.id), body: "Merci !" });
  });
});

describe("friends feed", () => {
  it("shows listens, hearts, ratings and reviews of followed members, newest first", async () => {
    const [viewer, friend, stranger] = [await member(), await member(), await member()];
    await viewer.call().social.follow({ username: friend.username });
    await friend
      .call(daysAgo(3))
      .listening.entry.create(listen(release(nocturnes), "2026-10-18", 8));
    await friend.call(daysAgo(2)).listening.quickLike({ target: release(leRoi), liked: true });
    const written = await review(friend, { target: smokeRings, at: daysAgo(1) });
    await friend.call().listening.entry.create({
      ...listen(release(leRoi), "2026-10-21", 9),
      review: { body: "Royal.", lang: "fr" },
    });
    await stranger.call().listening.entry.create(listen(release(nocturnes), "2026-10-21", 4));

    const feed = await viewer.call().feed.friends({});
    expect(feed.items.map((i) => i.kind)).toEqual(["listen", "review", "listen", "listen"]);
    const [withReview, standalone, heart, dated] = feed.items;
    expect(withReview).toMatchObject({ kind: "listen", rating: 9, review: { body: "Royal." } });
    expect(standalone).toMatchObject({ kind: "review", review: { id: written.id } });
    expect(heart).toMatchObject({ kind: "listen", listenedOn: null, liked: true });
    expect(dated).toMatchObject({ kind: "listen", listenedOn: "2026-10-18", rating: 8 });
    expect(feed.nextCursor).toBeNull();
  });

  it("never shows the listens of a private diary (its reviews stay public)", async () => {
    const [viewer, secret] = [await member(), await member({ diaryPrivate: true })];
    await viewer.call().social.follow({ username: secret.username });
    await secret.call().listening.entry.create({
      ...listen(release(nocturnes), "2026-10-20", 7),
      review: { body: "Chut.", lang: "fr" },
    });
    await secret.call().listening.quickLike({ target: release(leRoi), liked: true });
    const feed = await viewer.call().feed.friends({});
    expect(feed.items).toEqual([expect.objectContaining({ kind: "review" })]);
    expect(JSON.stringify(feed)).not.toContain("2026-10-20");
  });

  it("pages with a cursor, without gaps or repeats", async () => {
    const [viewer, friend] = [await member(), await member()];
    await viewer.call().social.follow({ username: friend.username });
    const total = FEED_PAGE_SIZE + 5;
    for (let i = 0; i < total; i++) {
      const day = `2026-${String(1 + (i % 9)).padStart(2, "0")}-${String(1 + i).padStart(2, "0")}`;
      await friend.call().listening.entry.create(listen(release(nocturnes), day));
    }
    const first = await viewer.call().feed.friends({});
    const second = await viewer.call().feed.friends({ cursor: first.nextCursor! });
    const ids = [...first.items, ...second.items].map((i) => i.id);
    expect(first.items).toHaveLength(FEED_PAGE_SIZE);
    expect(new Set(ids).size).toBe(total);
    expect(second.nextCursor).toBeNull();
  });

  it("hides ratings of records the blind viewer has not rated", async () => {
    const [viewer, friend] = [await member({ blindMode: true }), await member()];
    await viewer.call().social.follow({ username: friend.username });
    await friend.call().listening.entry.create({
      ...listen(release(leRoi), "2026-10-20", 9),
      review: { body: "Grand.", lang: "fr" },
    });
    await friend
      .call()
      .listening.entry.create(listen({ kind: "track", id: leRoiTrack }, "2026-10-19", 6));

    const hidden = await viewer.call().feed.friends({});
    const [trackListen, albumListen] = hidden.items; // newest first
    expect(albumListen).toMatchObject({ rating: null, review: { rating: null } });
    expect(albumListen?.kind === "listen" && albumListen.release.ratingsHidden).toBe(true);
    expect(trackListen).toMatchObject({ rating: null });

    await viewer.call().listening.quickRate({ target: release(leRoi), rating: 5 });
    await viewer
      .call()
      .listening.quickRate({ target: { kind: "track", id: leRoiTrack }, rating: 5 });
    const shown = await viewer.call().feed.friends({});
    expect(shown.items[0]).toMatchObject({ rating: 6 });
    expect(shown.items[1]).toMatchObject({ rating: 9, review: { rating: 9 } });
  });

  it("suggests active members to a newcomer whose feed is empty", async () => {
    const [newcomer, blocker] = [await member(), await member()];
    await blocker.call().listening.markListened(release(nocturnes));
    await blocker.call().block.add({ username: newcomer.username });
    expect((await newcomer.call().feed.friends({})).items).toEqual([]);
    const suggestions = await newcomer.call().feed.suggestions();
    expect(suggestions.length).toBeGreaterThan(0);
    const names = suggestions.map((s) => s.username);
    expect(names).not.toContain(newcomer.username);
    expect(names).not.toContain(blocker.username);
    expect(suggestions.every((s) => !s.viewerFollows)).toBe(true);
  });
});

describe("popular reviews", () => {
  async function engage(reviewId: string, likers: Member[], commenters: Member[], at = now) {
    for (const m of likers)
      await m.call(at).like.set({ subject: reviewSubject(reviewId), liked: true });
    for (const m of commenters) {
      await m.call(at).comment.create({ subject: reviewSubject(reviewId), body: "Oui." });
    }
  }

  it("ranks the week's likes and comments, split by review language", async () => {
    const lang = "en";
    const authors = [await member(), await member(), await member()];
    const fans = [await member(), await member(), await member()];
    const liked = await review(authors[0]!, { lang });
    const commented = await review(authors[1]!, { lang });
    const old = await review(authors[2]!, { lang });
    const french = await review(authors[2]!, { lang: "fr", target: leRoi });
    await engage(liked.id, fans, []); // 3 points
    await engage(commented.id, [], fans.slice(0, 2)); // 4 points
    await engage(old.id, fans, fans, daysAgo(8)); // outside the week
    await engage(french.id, fans, fans);
    // The author's own comment does not count.
    await authors[0]!.call().comment.create({ subject: reviewSubject(liked.id), body: "Merci." });

    const ids = (await api(null).feed.popular({ lang })).items.map((r) => r.id);
    expect(ids.indexOf(commented.id)).toBeLessThan(ids.indexOf(liked.id));
    expect(ids).not.toContain(old.id);
    expect(ids).not.toContain(french.id);
    expect((await api(null).feed.popular({ lang: "fr" })).items.map((r) => r.id)).toContain(
      french.id,
    );
  });

  it("leaves out reviews of members blocked either way", async () => {
    const [viewer, blocked, blocker, fan] = [
      await member(),
      await member(),
      await member(),
      await member(),
    ];
    const mine = await review(blocked, { lang: "en" });
    const theirs = await review(blocker, { lang: "en" });
    await engage(mine.id, [fan], []);
    await engage(theirs.id, [fan], []);
    await viewer.call().block.add({ username: blocked.username });
    await blocker.call().block.add({ username: viewer.username });
    const ids = (await viewer.call().feed.popular({ lang: "en" })).items.map((r) => r.id);
    expect(ids).not.toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    const anonymous = (await api(null).feed.popular({ lang: "en" })).items.map((r) => r.id);
    expect(anonymous).toEqual(expect.arrayContaining([mine.id, theirs.id]));
  });

  it("hides ratings for a blind viewer", async () => {
    const [viewer, author, fan] = [
      await member({ blindMode: true }),
      await member(),
      await member(),
    ];
    await author.call().listening.quickRate({ target: release(smokeRings), rating: 7 });
    const written = await review(author, { lang: "en", target: smokeRings });
    await engage(written.id, [fan], []);
    const card = (await viewer.call().feed.popular({ lang: "en" })).items.find(
      (r) => r.id === written.id,
    );
    expect(card?.rating).toBeNull();
    expect((await viewer.call().review.byId({ id: written.id }))?.review.rating).toBeNull();
    expect((await api(null).review.byId({ id: written.id }))?.review.rating).toBe(7);
  });
});

describe("likes and notifications", () => {
  it("groups similar notifications and counts unread groups", async () => {
    const author = await member();
    const written = await review(author);
    const likers = [await member(), await member(), await member(), await member()];
    for (const [i, m] of likers.entries()) {
      await m.call(minutesLater(i)).like.set({ subject: reviewSubject(written.id), liked: true });
    }
    await likers[0]!.call(minutesLater(10)).social.follow({ username: author.username });

    expect(await author.call().notification.unreadCount()).toBe(2);
    const { items } = await author.call().notification.list({});
    expect(items.map((g) => g.type)).toEqual(["follow", "like"]);
    expect(items[1]).toMatchObject({ actorCount: 4, unread: true, review: { id: written.id } });
    expect(items[1]!.actors.map((a) => a.username)).toEqual(
      likers
        .slice(1)
        .reverse()
        .map((m) => m.username),
    );
    const detail = await author.call().review.byId({ id: written.id });
    expect(detail?.review.likeCount).toBe(4);

    await author.call().notification.markAllRead();
    expect(await author.call().notification.unreadCount()).toBe(0);
    expect((await author.call().notification.list({})).items.every((g) => !g.unread)).toBe(true);

    // Unliking removes the like and its notification.
    const result = await likers[3]!
      .call()
      .like.set({ subject: reviewSubject(written.id), liked: false });
    expect(result).toEqual({ liked: false, likeCount: 3 });
    const likeGroup = (await author.call().notification.list({})).items.find(
      (g) => g.type === "like",
    );
    expect(likeGroup?.actorCount).toBe(3);
  });

  it("shows whether the viewer liked a review", async () => {
    const [author, fan] = [await member(), await member()];
    const written = await review(author);
    await fan.call().like.set({ subject: reviewSubject(written.id), liked: true });
    expect(await fan.call().review.byId({ id: written.id })).toMatchObject({
      viewerLiked: true,
      canLike: true,
      canComment: true,
      isOwner: false,
    });
    expect(await api(null).review.byId({ id: written.id })).toMatchObject({
      canLike: false,
      canComment: false,
    });
  });
});

describe("comments", () => {
  it("limits their length", async () => {
    const [author, fan] = [await member(), await member()];
    const written = await review(author);
    const create = (body: string) =>
      fan.call().comment.create({ subject: reviewSubject(written.id), body });
    expect(await errorCode(() => create("x".repeat(COMMENT_BODY_MAX + 1)))).toBe("BAD_REQUEST");
    expect(await errorCode(() => create("   "))).toBe("BAD_REQUEST");
    await create("x".repeat(COMMENT_BODY_MAX));
  });

  it("are edited by their author only, and deleted by their author or the review's", async () => {
    const [author, fan, other] = [await member(), await member(), await member()];
    const written = await review(author);
    const subject = reviewSubject(written.id);
    const first = await fan.call().comment.create({ subject, body: "Belle critique." });
    const second = await fan.call(minutesLater(1)).comment.create({ subject, body: "Vraiment." });
    const third = await other.call(minutesLater(2)).comment.create({ subject, body: "Bof." });

    const edited = await fan.call().comment.update({ id: first.id, body: "Très belle critique." });
    expect(edited).toMatchObject({ body: "Très belle critique.", edited: true });
    expect(
      await errorCode(() => other.call().comment.update({ id: first.id, body: "Pirate" })),
    ).toBe("COMMENT_NOT_FOUND");
    expect(await errorCode(() => author.call().comment.update({ id: first.id, body: "Non" }))).toBe(
      "COMMENT_NOT_FOUND",
    );
    // A third member cannot delete someone else's comment.
    expect(await errorCode(() => other.call().comment.delete({ id: first.id }))).toBe(
      "COMMENT_NOT_FOUND",
    );

    const asAuthor = await author.call().comment.list({ subject });
    expect(asAuthor.items.map((c) => [c.canEdit, c.canDelete])).toEqual([
      [false, true],
      [false, true],
      [false, true],
    ]);
    const asFan = await fan.call().comment.list({ subject });
    expect(asFan.items.map((c) => [c.canEdit, c.canDelete])).toEqual([
      [true, true],
      [true, true],
      [false, false],
    ]);

    await fan.call().comment.delete({ id: second.id }); // its author
    await author.call().comment.delete({ id: third.id }); // the review's author
    const left = await api(null).comment.list({ subject });
    expect(left.items.map((c) => c.id)).toEqual([first.id]);
    expect((await api(null).review.byId({ id: written.id }))?.review.commentCount).toBe(1);
    const group = (await author.call().notification.list({})).items.find(
      (g) => g.type === "comment",
    );
    expect(group?.actorCount).toBe(1);
    expect(await errorCode(() => fan.call().comment.update({ id: second.id, body: "Re" }))).toBe(
      "COMMENT_NOT_FOUND",
    );
  });

  it("pages oldest first", async () => {
    const [author, fan] = [await member(), await member()];
    const written = await review(author);
    const subject = reviewSubject(written.id);
    for (let i = 0; i < COMMENTS_PAGE_SIZE + 1; i++) {
      await handle.db.insert(schema.comments).values({
        userId: fan.user.id,
        reviewId: written.id,
        body: `#${i}`,
        createdAt: minutesLater(i),
      });
    }
    const first = await api(null).comment.list({ subject });
    const second = await api(null).comment.list({ subject, cursor: first.nextCursor! });
    expect(first.items[0]?.body).toBe("#0");
    expect(second.items.map((c) => c.body)).toEqual([`#${COMMENTS_PAGE_SIZE}`]);
  });

  it("work on lists too (likes, comments, notifications, owner deletion)", async () => {
    const [owner, fan] = [await member(), await member()];
    const [list] = await handle.db
      .insert(schema.lists)
      .values({ userId: owner.user.id, title: "Pluie" })
      .returning();
    const subject = { kind: "list" as const, id: list!.id };
    expect(await fan.call().like.set({ subject, liked: true })).toEqual({
      liked: true,
      likeCount: 1,
    });
    const comment = await fan
      .call(minutesLater(1))
      .comment.create({ subject, body: "Jolie liste." });
    const groups = (await owner.call().notification.list({})).items;
    expect(groups.map((g) => [g.type, g.list?.title])).toEqual([
      ["comment", "Pluie"],
      ["like", "Pluie"],
    ]);
    expect(await errorCode(() => owner.call().like.set({ subject, liked: true }))).toBe(
      "SELF_ACTION",
    );
    await owner.call().comment.delete({ id: comment.id });
    expect((await api(null).comment.list({ subject })).items).toEqual([]);
  });
});

describe("blocking", () => {
  async function pairWithHistory() {
    const [blocker, blocked] = [await member(), await member()];
    await blocker.call().social.follow({ username: blocked.username });
    await blocked.call().social.follow({ username: blocker.username });
    const blockerReview = await review(blocker);
    const blockedReview = await review(blocked);
    await blocked.call().like.set({ subject: reviewSubject(blockerReview.id), liked: true });
    await blocker.call().like.set({ subject: reviewSubject(blockedReview.id), liked: true });
    await blocker.call().block.add({ username: blocked.username });
    return { blocker, blocked, blockerReview, blockedReview };
  }

  it("ends following both ways and erases their notifications to each other", async () => {
    const { blocker, blocked } = await pairWithHistory();
    for (const [m, other] of [
      [blocker, blocked],
      [blocked, blocker],
    ] as const) {
      const profile = await m.call().profile.byUsername({ username: other.username });
      expect(profile).toMatchObject({ viewerFollows: false, canInteract: false });
      expect((await m.call().notification.list({})).items).toEqual([]);
    }
  });

  it("forbids following, liking and commenting, in both directions", async () => {
    const { blocker, blocked, blockerReview, blockedReview } = await pairWithHistory();
    const attempts: [Member, Member, string][] = [
      [blocked, blocker, blockerReview.id],
      [blocker, blocked, blockedReview.id],
    ];
    for (const [m, other, reviewId] of attempts) {
      const subject = reviewSubject(reviewId);
      expect(await errorCode(() => m.call().social.follow({ username: other.username }))).toBe(
        "ACTION_UNAVAILABLE",
      );
      expect(await errorCode(() => m.call().like.set({ subject, liked: true }))).toBe(
        "ACTION_UNAVAILABLE",
      );
      expect(await errorCode(() => m.call().comment.create({ subject, body: "Hé" }))).toBe(
        "ACTION_UNAVAILABLE",
      );
      expect(await m.call().review.byId({ id: reviewId })).toMatchObject({
        canLike: false,
        canComment: false,
      });
    }
  });

  it("keeps each out of the other's feed and comments", async () => {
    const { blocker, blocked } = await pairWithHistory();
    // Even if a follow row slipped through, the feed filters the block.
    await handle.db.insert(schema.follows).values([
      { followerId: blocker.user.id, followeeId: blocked.user.id },
      { followerId: blocked.user.id, followeeId: blocker.user.id },
    ]);
    await blocker.call().listening.markListened(release(nocturnes));
    await blocked.call().listening.markListened(release(nocturnes));
    expect((await blocker.call().feed.friends({})).items).toEqual([]);
    expect((await blocked.call().feed.friends({})).items).toEqual([]);

    const host = await member();
    const hosted = await review(host);
    const subject = reviewSubject(hosted.id);
    await blocker.call().comment.create({ subject, body: "Du bloqueur" });
    await blocked.call(minutesLater(1)).comment.create({ subject, body: "Du bloqué" });
    const bodies = async (m: Member | null) =>
      (await (m ? m.call() : api(null)).comment.list({ subject })).items.map((c) => c.body);
    expect(await bodies(blocker)).toEqual(["Du bloqueur"]);
    expect(await bodies(blocked)).toEqual(["Du bloqué"]);
    expect(await bodies(host)).toEqual(["Du bloqueur", "Du bloqué"]);

    expect(await blocker.call().feed.suggestions()).not.toContainEqual(
      expect.objectContaining({ username: blocked.username }),
    );
  });

  it("is never told to the blocked member, and can be undone from the settings list", async () => {
    const { blocker, blocked } = await pairWithHistory();
    const seenByBlocked = await blocked.call().profile.byUsername({ username: blocker.username });
    expect(seenByBlocked).toMatchObject({ viewerBlocked: false, canInteract: false });
    expect(await blocked.call().block.list()).toEqual([]);
    expect(JSON.stringify(await blocked.call().notification.list({}))).not.toContain("block");

    const seenByBlocker = await blocker.call().profile.byUsername({ username: blocked.username });
    expect(seenByBlocker).toMatchObject({ viewerBlocked: true, canInteract: false });
    expect((await blocker.call().block.list()).map((b) => b.username)).toEqual([blocked.username]);

    await blocker.call().block.remove({ username: blocked.username });
    expect(await blocker.call().block.list()).toEqual([]);
    await blocked.call().social.follow({ username: blocker.username });
    expect((await blocker.call().notification.list({})).items[0]?.type).toBe("follow");
  });

  it("creates no notification across a block", async () => {
    const { blocker, blocked } = await pairWithHistory();
    await blocker.call().block.remove({ username: blocked.username });
    await blocked.call().block.add({ username: blocker.username }); // now the other way
    expect(
      await errorCode(() => blocker.call().social.follow({ username: blocked.username })),
    ).toBe("ACTION_UNAVAILABLE");
    expect(await blocked.call().notification.unreadCount()).toBe(0);
  });
});

describe("reports", () => {
  it("records reports on a review, a comment and a profile, once while open", async () => {
    const [reporter, author] = [await member(), await member()];
    const written = await review(author);
    const comment = await author
      .call()
      .comment.create({ subject: reviewSubject(written.id), body: "Pub !" });
    await reporter.call().report.create({
      subject: { kind: "review", id: written.id },
      reason: "spoiler",
      details: "  Raconte la fin.  ",
    });
    await reporter
      .call()
      .report.create({ subject: { kind: "review", id: written.id }, reason: "spam" });
    await reporter
      .call()
      .report.create({ subject: { kind: "comment", id: comment.id }, reason: "spam" });
    await reporter.call().report.create({
      subject: { kind: "member", username: author.username },
      reason: "harassment",
    });
    const rows = await handle.db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.reporterId, reporter.user.id));
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.reviewId === written.id)).toMatchObject({
      reason: "spoiler",
      details: "Raconte la fin.",
      status: "open",
    });
    expect(rows.find((r) => r.commentId === comment.id)?.reason).toBe("spam");
    expect(rows.find((r) => r.reportedUserId === author.user.id)?.reason).toBe("harassment");
  });

  it("refuses an unknown reason", async () => {
    const [reporter, author] = [await member(), await member()];
    const call = () =>
      reporter.call().report.create({
        subject: { kind: "member", username: author.username },
        reason: "catalog_error" as "spam",
      });
    expect(await errorCode(call)).toBe("BAD_REQUEST");
  });
});

describe("rate limits", () => {
  it("cap every social write per member", async () => {
    const [m, other] = [await member(), await member()];
    const written = await review(other);
    const subject = reviewSubject(written.id);
    const cases: [string, number, () => Promise<unknown>][] = [
      ["follow-write", 200, () => m.call().social.follow({ username: other.username })],
      ["like-write", 300, () => m.call().like.set({ subject, liked: true })],
      ["comment-write", 60, () => m.call().comment.create({ subject, body: "Encore" })],
      ["block-write", 60, () => m.call().block.add({ username: other.username })],
      [
        "report-write",
        20,
        () =>
          m.call().report.create({ subject: { kind: "review", id: written.id }, reason: "spam" }),
      ],
    ];
    for (const [bucket, max, call] of cases) {
      await handle.db
        .insert(schema.rateLimits)
        .values({ key: `${bucket}:${m.user.id}`, count: max, windowStart: new Date() });
      expect(await errorCode(call)).toBe("RATE_LIMITED");
    }
  });

  it("require being signed in", async () => {
    const m = await member();
    expect(await errorCode(() => api(null).social.follow({ username: m.username }))).toBe(
      "UNAUTHENTICATED",
    );
    expect(await errorCode(() => api(null).feed.friends({}))).toBe("UNAUTHENTICATED");
  });
});

describe("account deletion", () => {
  it("removes follows, likes, comments, notifications and blocks, keeps reports detached", async () => {
    const [leaving, friend] = [await member(), await member()];
    const friendReview = await review(friend);
    const subject = reviewSubject(friendReview.id);
    await leaving.call().social.follow({ username: friend.username });
    await friend.call().social.follow({ username: leaving.username });
    await leaving.call().like.set({ subject, liked: true });
    const comment = await leaving.call().comment.create({ subject, body: "Au revoir" });
    await leaving.call().block.add({ username: (await member()).username });
    await leaving
      .call()
      .report.create({ subject: { kind: "review", id: friendReview.id }, reason: "other" });

    await leaving.call().account.delete({ confirmUsername: leaving.username });

    const id = leaving.user.id;
    const count = handle.db.$count.bind(handle.db);
    const { follows, likes, comments, notifications, blocks, reports } = schema;
    expect(
      await count(follows, sql`${follows.followerId} = ${id} or ${follows.followeeId} = ${id}`),
    ).toBe(0);
    expect(await count(likes, sql`${likes.userId} = ${id}`)).toBe(0);
    expect(await count(comments, sql`${comments.id} = ${comment.id}`)).toBe(0);
    expect(
      await count(
        notifications,
        sql`${notifications.userId} = ${id} or ${notifications.actorId} = ${id}`,
      ),
    ).toBe(0);
    expect(
      await count(blocks, sql`${blocks.blockerId} = ${id} or ${blocks.blockedId} = ${id}`),
    ).toBe(0);
    const [kept] = await handle.db
      .select()
      .from(reports)
      .where(eq(reports.reviewId, friendReview.id));
    expect(kept).toMatchObject({ reporterId: null, reason: "other" });
    expect(await friend.call().notification.unreadCount()).toBe(0);
    expect((await api(null).review.byId({ id: friendReview.id }))?.review).toMatchObject({
      likeCount: 0,
      commentCount: 0,
    });
  });
});

describe("demo seed", () => {
  it("makes the feed and notifications of the demo members lively", async () => {
    const camille = { id: fixtureId(301), email: "nuitblanche@example.test" };
    const feed = await api(camille).feed.friends({});
    expect(feed.items.length).toBeGreaterThan(3);
    const notes = await api(camille).notification.list({});
    expect(notes.items.some((g) => g.type === "like" && g.actorCount >= 3)).toBe(true);
    expect(await api(camille).notification.unreadCount()).toBeGreaterThan(0);
    expect((await api(null).feed.popular({ lang: "fr" })).items.length).toBeGreaterThan(0);
    expect((await api(null).feed.popular({ lang: "en" })).items.length).toBeGreaterThan(0);
  });

  it("is idempotent", async () => {
    const before = await handle.db.$count(schema.notifications);
    await seed(handle.db, { now });
    expect(await handle.db.$count(schema.notifications)).toBe(before);
  });
});
