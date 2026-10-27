import { and, eq, schema, seed, sql, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { fixtureId } from "@spleen/db/fixtures";
import type { Email } from "@spleen/infra/email";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CONTACT_PLACEHOLDER, suspensionEmail } from "./lib/moderation/emails";
import { anonymizeModerationHistory, MODERATION_RETENTION_DAYS } from "./lib/moderation/history";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

let handle: DbHandle;
const now = new Date("2026-10-21T12:00:00Z");
const nocturnes = fixtureId(201);
const ADMIN: SessionUser = { id: fixtureId(44_000), email: "lacontrebasse@example.test" };
const CONTACT = "moderation@spleen.example";

let outbox: Email[] = [];
let failMail = false;
const mailer = () => ({
  async send(email: Email) {
    if (failMail) throw new Error("provider down");
    outbox.push(email);
  },
});

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db, { now });
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(() => {
  outbox = [];
  failMail = false;
});

function api(user: SessionUser | null, at = now, contactEmail: string | null = CONTACT) {
  return createCaller(
    createContext({ now: at, db: () => handle.db, user: async () => user, mailer, contactEmail }),
  );
}
/** Each admin call happens a second after the previous one: decisions keep their order. */
let clock = 0;
const admin = () => api(ADMIN, new Date(now.getTime() + ++clock * 1000));

let memberCount = 0;
async function member() {
  memberCount += 1;
  const username = `moder${memberCount}`;
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
  return { user, username, call: (at = now) => api(user, at) };
}
type Member = Awaited<ReturnType<typeof member>>;

async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof TRPCError) return error.message;
    throw error;
  }
  throw new Error("expected an error");
}

const writeReview = (m: Member, body = "Un disque de pluie.") =>
  m.call().review.create({ target: { kind: "release", id: nocturnes }, body, lang: "fr" });

/** `reporter` reports `subject`, then returns the open report as the queue shows it. */
async function reportOf(
  reporter: Member,
  subject: Parameters<ReturnType<typeof api>["report"]["create"]>[0]["subject"],
  reason: "spam" | "harassment" | "spoiler" = "spam",
) {
  await reporter.call().report.create({ subject, reason });
  const [row] = await handle.db
    .select({ id: schema.reports.id })
    .from(schema.reports)
    .where(and(eq(schema.reports.reporterId, reporter.user.id), eq(schema.reports.status, "open")))
    .orderBy(sql`${schema.reports.createdAt} desc`)
    .limit(1);
  return row!.id;
}

async function lastAction() {
  const [row] = await handle.db
    .select()
    .from(schema.moderationActions)
    .orderBy(sql`${schema.moderationActions.createdAt} desc`, sql`${schema.moderationActions.id}`)
    .limit(1);
  return row!;
}

const moderationNotices = async (m: Member) =>
  (await m.call().notification.list({})).items.filter((n) => n.type === "moderation");

describe("admin access (checked on the server)", () => {
  const calls = (caller: ReturnType<typeof api>) => [
    () => caller.admin.reports({}),
    () => caller.admin.history({}),
    () => caller.admin.suspended(),
    () =>
      caller.admin.decide({
        reportId: fixtureId(44_200),
        decision: "dismiss",
        reason: "Pas grave",
      }),
    () => caller.admin.suspend({ username: "bruitdefond", reason: "Spam répété" }),
    () => caller.admin.unsuspend({ username: "bruitdefond", reason: "Levée" }),
    () =>
      caller.admin.restore({ subject: { kind: "review", id: fixtureId(501) }, reason: "Erreur" }),
  ];

  it("asks visitors to sign in on every admin procedure", async () => {
    for (const call of calls(api(null))) expect(await errorCode(call)).toBe("UNAUTHENTICATED");
  });

  it("answers NOT_FOUND to members, as if nothing were there", async () => {
    const m = await member();
    for (const call of calls(m.call())) expect(await errorCode(call)).toBe("NOT_FOUND");
  });

  it("lets the admin in and tells the header", async () => {
    expect((await admin().admin.reports({})).total).toBeGreaterThan(0);
    expect(await admin().account.me()).toMatchObject({ isAdmin: true });
    expect(await (await member()).call().account.me()).toMatchObject({ isAdmin: false });
  });

  it("drops the role of a suspended admin's session (the role is read on every request)", async () => {
    const m = await member();
    await handle.db
      .update(schema.profiles)
      .set({ role: "admin", suspendedAt: now, suspensionReason: "Test" })
      .where(eq(schema.profiles.userId, m.user.id));
    expect(await errorCode(() => m.call().admin.reports({}))).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("report queue", () => {
  it("filters by status and by kind, open reports oldest first", async () => {
    const open = await admin().admin.reports({});
    expect(open.items.every((r) => r.status === "open")).toBe(true);
    const times = open.items.map((r) => r.createdAt);
    expect(times).toEqual([...times].sort());
    const kinds = new Set(open.items.map((r) => r.subject.kind));
    expect(kinds).toEqual(new Set(["member", "comment", "list", "review", "catalog"]));

    const catalog = await admin().admin.reports({ kind: "catalog" });
    expect(catalog.items.map((r) => r.reason).sort()).toEqual([
      "catalog_addition",
      "catalog_error",
    ]);
    expect(catalog.items.every((r) => r.decisions.join() === "dismiss,resolve")).toBe(true);

    const dismissed = await admin().admin.reports({ status: "dismissed", kind: "review" });
    expect(dismissed.items).toHaveLength(1);
    expect(dismissed.items[0]).toMatchObject({
      decisions: [],
      resolution: { by: { username: "lacontrebasse" } },
    });
  });

  it("shows what a report points to, with the author and the other open reports", async () => {
    const [author, a, b] = [await member(), await member(), await member()];
    const written = await writeReview(author, "Texte signalé deux fois.");
    await reportOf(a, { kind: "review", id: written.id });
    await reportOf(b, { kind: "review", id: written.id }, "harassment");
    const { items } = await admin().admin.reports({ kind: "review" });
    const view = items.find((r) => r.subject.href === `/review/${written.id}`)!;
    expect(view).toMatchObject({
      sameSubjectOpen: 1,
      subject: {
        label: "Texte signalé deux fois.",
        member: { username: author.username, suspended: false },
      },
      decisions: ["dismiss", "hide", "delete", "suspend"],
    });
  });
});

describe("decisions", () => {
  it("dismisses: closes every open report on the subject, records reason and author, no notice", async () => {
    const [author, a, b] = [await member(), await member(), await member()];
    const written = await writeReview(author);
    const first = await reportOf(a, { kind: "review", id: written.id });
    await reportOf(b, { kind: "review", id: written.id });
    await admin().admin.decide({
      reportId: first,
      decision: "dismiss",
      reason: "Critique correcte",
    });
    const rows = await handle.db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.reviewId, written.id));
    expect(rows.map((r) => r.status)).toEqual(["dismissed", "dismissed"]);
    expect(rows.every((r) => r.resolvedById === ADMIN.id)).toBe(true);
    expect(await lastAction()).toMatchObject({
      action: "dismiss",
      reason: "Critique correcte",
      moderatorId: ADMIN.id,
      targetUserId: author.user.id,
      reportReason: "spam",
    });
    expect(await moderationNotices(author)).toEqual([]);
    expect(
      await errorCode(() =>
        admin().admin.decide({ reportId: first, decision: "hide", reason: "Trop tard" }),
      ),
    ).toBe("MODERATION_ACTION_INVALID");
  });

  it("hides a review everywhere, keeps it in the database, and tells its author why", async () => {
    const [author, reporter] = [await member(), await member()];
    const written = await writeReview(author, "Une critique pleine d'insultes.");
    const reportId = await reportOf(reporter, { kind: "review", id: written.id });
    await admin().admin.decide({
      reportId,
      decision: "hide",
      reason: "Insultes envers un artiste",
    });

    expect(await api(null).review.byId({ id: written.id })).toBeNull();
    const profileReviews = await api(null).profile.reviews({ username: author.username, page: 1 });
    expect(profileReviews!.items).toEqual([]);
    expect(
      await errorCode(() =>
        reporter.call().like.set({ subject: { kind: "review", id: written.id }, liked: true }),
      ),
    ).toBe("REVIEW_NOT_FOUND");
    const [row] = await handle.db
      .select({ hiddenBy: schema.reviews.hiddenBy })
      .from(schema.reviews)
      .where(eq(schema.reviews.id, written.id));
    expect(row).toEqual({ hiddenBy: "moderation" });

    const [notice] = await moderationNotices(author);
    expect(notice!.moderation).toEqual({
      action: "hide",
      subject: "review",
      reason: "Insultes envers un artiste",
      excerpt: "Une critique pleine d'insultes.",
      contactEmail: CONTACT,
    });
  });

  it("deletes a review: gone with its reports, the history keeps the excerpt", async () => {
    const [author, reporter] = [await member(), await member()];
    const written = await writeReview(author, "Du spam déguisé en critique.");
    const reportId = await reportOf(reporter, { kind: "review", id: written.id });
    await admin().admin.decide({ reportId, decision: "delete", reason: "Publicité" });
    expect(await handle.db.$count(schema.reviews, eq(schema.reviews.id, written.id))).toBe(0);
    expect(await handle.db.$count(schema.reports, eq(schema.reports.id, reportId))).toBe(0);
    expect(await lastAction()).toMatchObject({
      action: "delete",
      reason: "Publicité",
      reviewId: null,
      reportId: null,
      reportReason: "spam",
      excerpt: "Du spam déguisé en critique.",
      targetUserId: author.user.id,
    });
    expect((await moderationNotices(author))[0]!.moderation).toMatchObject({ action: "delete" });
  });

  it("deletes a comment like its author would (the thread stays readable)", async () => {
    const [owner, author, reporter] = [await member(), await member(), await member()];
    const written = await writeReview(owner);
    const comment = await author
      .call()
      .comment.create({ subject: { kind: "review", id: written.id }, body: "Achetez mes NFT" });
    const reportId = await reportOf(reporter, { kind: "comment", id: comment.id });
    await admin().admin.decide({ reportId, decision: "delete", reason: "Spam" });
    const [row] = await handle.db
      .select({ deletedAt: schema.comments.deletedAt })
      .from(schema.comments)
      .where(eq(schema.comments.id, comment.id));
    expect(row!.deletedAt).not.toBeNull();
    const thread = await api(null).comment.list({ subject: { kind: "review", id: written.id } });
    expect(thread.items).toEqual([]);
  });

  it("resolves a catalog report with a note, without notifying anyone", async () => {
    const { items } = await admin().admin.reports({ kind: "catalog" });
    const report = items.find((r) => r.reason === "catalog_error")!;
    const before = await handle.db.$count(schema.notifications);
    await admin().admin.decide({
      reportId: report.id,
      decision: "resolve",
      reason: "Date corrigée",
    });
    const [row] = await handle.db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.id, report.id));
    expect(row).toMatchObject({ status: "resolved", resolutionNote: "Date corrigée" });
    expect(await handle.db.$count(schema.notifications)).toBe(before);
    expect(await lastAction()).toMatchObject({ action: "resolve", subject: "catalog" });
  });

  it("refuses decisions that do not fit the subject", async () => {
    const { items } = await admin().admin.reports({ kind: "member" });
    const report = items.find((r) => r.status === "open")!;
    expect(
      await errorCode(() =>
        admin().admin.decide({ reportId: report.id, decision: "hide", reason: "Rien à masquer" }),
      ),
    ).toBe("MODERATION_ACTION_INVALID");
    expect(
      await errorCode(() =>
        admin().admin.decide({
          reportId: fixtureId(44_299),
          decision: "dismiss",
          reason: "Absent",
        }),
      ),
    ).toBe("REPORT_NOT_FOUND");
  });

  it("restores content hidden by a decision, and says so in the history", async () => {
    const [author, reporter] = [await member(), await member()];
    const written = await writeReview(author, "Finalement acceptable.");
    const reportId = await reportOf(reporter, { kind: "review", id: written.id });
    await admin().admin.decide({ reportId, decision: "hide", reason: "Doute" });
    const hidden = (await admin().admin.history({})).items.find(
      (a) => a.restorable?.id === written.id,
    );
    expect(hidden).toMatchObject({ action: "hide", moderator: { username: "lacontrebasse" } });
    await admin().admin.restore({
      subject: { kind: "review", id: written.id },
      reason: "Relu : rien d'interdit",
    });
    expect(await api(null).review.byId({ id: written.id })).not.toBeNull();
    expect(await lastAction()).toMatchObject({ action: "restore", targetUserId: author.user.id });
    expect(
      await errorCode(() =>
        admin().admin.restore({ subject: { kind: "review", id: written.id }, reason: "Encore" }),
      ),
    ).toBe("MODERATION_ACTION_INVALID");
  });
});

describe("hidden content, seen by its author alone", () => {
  it("shows a hidden review to its author with the reason, never to anyone else", async () => {
    const [author, reporter, other] = [await member(), await member(), await member()];
    const written = await writeReview(author, "Une critique masquée.");
    const reply = await other
      .call()
      .comment.create({ subject: { kind: "review", id: written.id }, body: "Bien vu." });
    const reportId = await reportOf(reporter, { kind: "review", id: written.id });
    await admin().admin.decide({ reportId, decision: "hide", reason: "Propos haineux" });

    const mine = await author.call().review.byId({ id: written.id });
    expect(mine).toMatchObject({
      review: { id: written.id, hidden: true },
      isOwner: true,
      canLike: false,
      canComment: false,
      hidden: { reason: "Propos haineux", contactEmail: CONTACT },
    });
    // Its thread stays readable for the author, closed to everyone.
    const thread = await author
      .call()
      .comment.list({ subject: { kind: "review", id: written.id } });
    expect(thread.items.map((c) => c.id)).toEqual([reply.id]);
    const profile = await author.call().profile.reviews({ username: author.username, page: 1 });
    expect(profile!.items).toMatchObject([{ id: written.id, hidden: true }]);

    for (const reader of [api(null), other.call(), reporter.call()]) {
      expect(await reader.review.byId({ id: written.id })).toBeNull();
      expect((await reader.profile.reviews({ username: author.username, page: 1 }))!.items).toEqual(
        [],
      );
      expect(
        await errorCode(() => reader.comment.list({ subject: { kind: "review", id: written.id } })),
      ).toBe("REVIEW_NOT_FOUND");
    }
    // Neither likes nor comments, the author's included.
    expect(
      await errorCode(() =>
        author.call().comment.create({ subject: { kind: "review", id: written.id }, body: "Re" }),
      ),
    ).toBe("REVIEW_NOT_FOUND");
    expect(
      await errorCode(() =>
        other.call().like.set({ subject: { kind: "review", id: written.id }, liked: true }),
      ),
    ).toBe("REVIEW_NOT_FOUND");
  });

  it("shows a hidden list to its owner, and nobody else", async () => {
    const [owner, reporter] = [await member(), await member()];
    const list = await owner
      .call()
      .list.create({ title: "Liste douteuse", description: "", ranked: false });
    const reportId = await reportOf(reporter, { kind: "list", id: list.id });
    await admin().admin.decide({ reportId, decision: "hide", reason: "Titre injurieux" });

    expect(await owner.call().list.byId({ id: list.id, page: 1 })).toMatchObject({
      isOwner: true,
      canComment: false,
      hidden: { reason: "Titre injurieux", contactEmail: CONTACT },
    });
    expect(
      (await owner.call().profile.lists({ username: owner.username, page: 1 }))!.items,
    ).toMatchObject([{ id: list.id, hidden: true }]);
    expect(await reporter.call().list.byId({ id: list.id, page: 1 })).toBeNull();
    expect((await api(null).profile.lists({ username: owner.username, page: 1 }))!.items).toEqual(
      [],
    );
    expect(
      await errorCode(() =>
        owner.call().comment.create({ subject: { kind: "list", id: list.id }, body: "Hé" }),
      ),
    ).toBe("LIST_NOT_FOUND");
  });

  it("shows a hidden comment to its author, who may delete it but not edit it", async () => {
    const [owner, author, reporter] = [await member(), await member(), await member()];
    const written = await writeReview(owner);
    const subject = { kind: "review" as const, id: written.id };
    const comment = await author.call().comment.create({ subject, body: "Un lien louche" });
    const reportId = await reportOf(reporter, { kind: "comment", id: comment.id });
    await admin().admin.decide({ reportId, decision: "hide", reason: "Lien malveillant" });

    const [seen] = (await author.call().comment.list({ subject })).items;
    expect(seen).toMatchObject({
      id: comment.id,
      canEdit: false,
      canDelete: true,
      hidden: { reason: "Lien malveillant", contactEmail: CONTACT },
    });
    for (const reader of [api(null), owner.call(), reporter.call()]) {
      expect((await reader.comment.list({ subject })).items).toEqual([]);
    }
    expect(
      await errorCode(() => author.call().comment.update({ id: comment.id, body: "Corrigé" })),
    ).toBe("COMMENT_NOT_FOUND");
    expect(await errorCode(() => owner.call().comment.delete({ id: comment.id }))).toBe(
      "COMMENT_NOT_FOUND",
    );
    await author.call().comment.delete({ id: comment.id });
    expect((await author.call().comment.list({ subject })).items).toEqual([]);
  });

  it("shows no reason once the history is anonymised, and a placeholder without contact", async () => {
    const [author, reporter] = [await member(), await member()];
    const written = await writeReview(author);
    const reportId = await reportOf(reporter, { kind: "review", id: written.id });
    await admin().admin.decide({ reportId, decision: "hide", reason: "Spoiler" });
    await handle.db
      .update(schema.moderationActions)
      .set({ reviewId: null })
      .where(eq(schema.moderationActions.reviewId, written.id));
    const detail = await api(author.user, now, null).review.byId({ id: written.id });
    expect(detail!.hidden).toEqual({ reason: null, contactEmail: CONTACT_PLACEHOLDER });
  });
});

describe("suspension", () => {
  async function suspended() {
    const [author, reporter, friend] = [await member(), await member(), await member()];
    const kept = await writeReview(author, "Ma critique tranquille.");
    const list = await author
      .call()
      .list.create({ title: "Mes nuits", description: "", ranked: false });
    const comment = await friend
      .call()
      .comment.create({ subject: { kind: "review", id: kept.id }, body: "Joli." });
    const answer = await author
      .call()
      .comment.create({ subject: { kind: "review", id: kept.id }, body: "Merci." });
    await friend.call().social.follow({ username: author.username });
    await handle.db.insert(schema.session).values({
      userId: author.user.id,
      token: `token-${author.username}`,
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    const reportId = await reportOf(reporter, { kind: "member", username: author.username });
    return { author, friend, kept, list, comment, answer, reportId };
  }

  it("suspends from a report: the account is a visitor, its sessions end, its content hides", async () => {
    const { author, kept, list, answer, reportId } = await suspended();
    const result = await admin().admin.decide({
      reportId,
      decision: "suspend",
      reason: "Harcèlement répété",
    });
    expect(result).toEqual({ emailSent: true });

    expect(await handle.db.$count(schema.session, eq(schema.session.userId, author.user.id))).toBe(
      0,
    );
    expect(await author.call().account.me()).toBeNull();
    expect(await errorCode(() => writeReview(author))).toBe("ACCOUNT_SUSPENDED");
    expect(
      await errorCode(() =>
        author.call().comment.create({ subject: { kind: "review", id: kept.id }, body: "Re" }),
      ),
    ).toBe("ACCOUNT_SUSPENDED");

    // Hidden, never deleted.
    expect(await api(null).profile.byUsername({ username: author.username })).toBeNull();
    expect(await api(null).review.byId({ id: kept.id })).toBeNull();
    expect(await api(null).list.byId({ id: list.id })).toBeNull();
    for (const [table, id] of [
      [schema.reviews, kept.id],
      [schema.lists, list.id],
      [schema.comments, answer.id],
    ] as const) {
      const [row] = await handle.db
        .select({ hiddenBy: table.hiddenBy })
        .from(table)
        .where(eq(table.id, id));
      expect(row).toEqual({ hiddenBy: "suspension" });
    }
  });

  it("emails the reason and how to contest it, and keeps a notification", async () => {
    const { author, reportId } = await suspended();
    await admin().admin.decide({ reportId, decision: "suspend", reason: "Spam en série" });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe(author.user.email);
    expect(outbox[0]!.text).toContain("Spam en série");
    expect(outbox[0]!.text).toContain(CONTACT);
    const [notice] = await handle.db
      .select({ reason: schema.moderationActions.reason })
      .from(schema.notifications)
      .innerJoin(
        schema.moderationActions,
        eq(schema.moderationActions.id, schema.notifications.moderationActionId),
      )
      .where(eq(schema.notifications.userId, author.user.id));
    expect(notice).toEqual({ reason: "Spam en série" });
  });

  it("keeps the decision when the email fails", async () => {
    const { author, reportId } = await suspended();
    failMail = true;
    const result = await admin().admin.decide({ reportId, decision: "suspend", reason: "Spam" });
    expect(result).toEqual({ emailSent: false });
    expect(await author.call().account.suspension()).toMatchObject({ reason: "Spam" });
  });

  it("shows the reason only to the signed-in member, who keeps their data rights", async () => {
    const { author, reportId } = await suspended();
    await admin().admin.decide({ reportId, decision: "suspend", reason: "Propos haineux" });
    expect(await author.call().account.suspension()).toEqual({
      username: author.username,
      suspendedAt: expect.any(String),
      reason: "Propos haineux",
      contactEmail: CONTACT,
    });
    expect(await api(null).account.suspension()).toBeNull();
    expect(await (await member()).call().account.suspension()).toBeNull();
    const data = await author.call().account.export();
    expect(data.format).toBe("spleen-export/1");
  });

  it("uses a placeholder when no contact address is configured", async () => {
    const email = await suspensionEmail("x@example.test", "Motif", null, "en");
    expect(email.text).toContain(CONTACT_PLACEHOLDER);
    expect(email.subject).toBe("Your Spleen account is suspended");
  });

  it("drops the suspended member's comments, feed items and member cards for everyone", async () => {
    const { author, friend, kept, comment, reportId } = await suspended();
    await admin().admin.decide({ reportId, decision: "suspend", reason: "Spam" });
    const followers = await api(null).social.following({ username: friend.username });
    expect(followers!.items.map((m) => m.username)).not.toContain(author.username);
    // The friend's comment on the hidden review survives, but the review is gone.
    const [row] = await handle.db
      .select({ hiddenAt: schema.comments.hiddenAt })
      .from(schema.comments)
      .where(eq(schema.comments.id, comment.id));
    expect(row!.hiddenAt).toBeNull();
    expect(await api(null).review.byId({ id: kept.id })).toBeNull();
    expect(await errorCode(() => friend.call().social.follow({ username: author.username }))).toBe(
      "MEMBER_NOT_FOUND",
    );
  });

  it("never suspends an admin, nor twice", async () => {
    expect(
      await errorCode(() => admin().admin.suspend({ username: "lacontrebasse", reason: "Essai" })),
    ).toBe("CANNOT_MODERATE_ADMIN");
    const m = await member();
    await admin().admin.suspend({ username: m.username, reason: "Spam" });
    expect(
      await errorCode(() => admin().admin.suspend({ username: m.username, reason: "Encore" })),
    ).toBe("ALREADY_SUSPENDED");
    expect((await admin().admin.suspended()).map((s) => s.username)).toContain(m.username);
  });

  it("lifts a suspension: what it hid comes back, a separate decision stays", async () => {
    const { author, kept, list, reportId } = await suspended();
    const other = await writeReview(author, "Celle-ci était masquée avant.");
    const reporter = await member();
    const otherReport = await reportOf(reporter, { kind: "review", id: other.id });
    await admin().admin.decide({ reportId: otherReport, decision: "hide", reason: "Spoiler" });
    await admin().admin.decide({ reportId, decision: "suspend", reason: "Spam" });

    await admin().admin.unsuspend({ username: author.username, reason: "Contestation acceptée" });
    expect(await author.call().account.suspension()).toBeNull();
    expect(await api(null).review.byId({ id: kept.id })).not.toBeNull();
    expect(await api(null).list.byId({ id: list.id })).not.toBeNull();
    expect(await api(null).review.byId({ id: other.id })).toBeNull();
    const notices = await moderationNotices(author);
    expect(notices.map((n) => n.moderation!.action)).toEqual(["unsuspend", "suspend", "hide"]);
    expect(
      await errorCode(() =>
        admin().admin.unsuspend({ username: author.username, reason: "Encore" }),
      ),
    ).toBe("NOT_SUSPENDED");
  });
});

describe("retention", () => {
  it("anonymises decisions and deletes closed reports one year after, never open ones", async () => {
    const [author, reporter, waiting] = [await member(), await member(), await member()];
    const written = await writeReview(author, "Vieux texte.");
    const reportId = await reportOf(reporter, { kind: "review", id: written.id });
    await admin().admin.decide({ reportId, decision: "hide", reason: "Spoiler" });
    const action = await lastAction();
    const openId = await reportOf(waiting, { kind: "member", username: author.username });

    const almost = new Date(now.getTime() + (MODERATION_RETENTION_DAYS - 1) * 86_400_000);
    await anonymizeModerationHistory(handle.db, almost);
    expect((await lastAction()).anonymizedAt).toBeNull();

    const later = new Date(now.getTime() + (MODERATION_RETENTION_DAYS + 1) * 86_400_000);
    const result = await anonymizeModerationHistory(handle.db, later);
    expect(result.actions).toBeGreaterThan(0);
    const [row] = await handle.db
      .select()
      .from(schema.moderationActions)
      .where(eq(schema.moderationActions.id, action.id));
    expect(row).toMatchObject({
      action: "hide",
      reason: "Spoiler",
      reportReason: "spam",
      moderatorId: null,
      targetUserId: null,
      reviewId: null,
      reportId: null,
      excerpt: "",
      anonymizedAt: later,
    });
    expect(await handle.db.$count(schema.reports, eq(schema.reports.id, reportId))).toBe(0);
    expect(await handle.db.$count(schema.reports, eq(schema.reports.id, openId))).toBe(1);
    expect(
      await handle.db.$count(
        schema.notifications,
        eq(schema.notifications.moderationActionId, action.id),
      ),
    ).toBe(0);
    // Idempotent.
    expect(await anonymizeModerationHistory(handle.db, later)).toEqual({ actions: 0, reports: 0 });
  });
});
