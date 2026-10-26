import { consumeRateLimit } from "@spleen/infra/rate-limit";
import {
  audienceLangSchema,
  commentCreateSchema,
  commentListSchema,
  commentUpdateSchema,
  cursorPageSchema,
  cursorSchema,
  likeSetSchema,
  recentReleasesSchema,
  topRatedSchema,
  trendsSchema,
  listCreateSchema,
  listItemAddSchema,
  listItemRemoveSchema,
  listPageSchema,
  listReorderSchema,
  listUpdateSchema,
  myListsSchema,
  memberPageSchema,
  memberSchema,
  reportCreateSchema,
  catalogImportSchema,
  catalogSearchSchema,
  deleteAccountSchema,
  entryCreateSchema,
  entryUpdateSchema,
  listenTargetSchema,
  moodLabelSchema,
  onboardingSchema,
  profileMonthSchema,
  profilePageSchema,
  profileUpdateSchema,
  quickLikeSchema,
  quickRateSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
  shelfRemoveSchema,
  shelfReorderSchema,
  shelfSetSchema,
  slugSchema,
  usernameSchema,
  wantToListenSchema,
  memberModerationSchema,
  moderationHistorySchema,
  reportDecisionSchema,
  reportQueueSchema,
  restoreContentSchema,
} from "@spleen/validators";
import { z } from "zod";

import {
  changeUsername,
  deleteAccount,
  exportAccount,
  getMe,
  onboard,
  removeAvatar,
  setAvatar,
  updateProfile,
} from "./lib/account";
import { importArtist, importEntity, importReleaseGroup } from "./lib/catalog/import";
import {
  artistIdBySlug,
  getArtistDetail,
  getReleaseDetail,
  getTrackDetail,
  releaseIdBySlug,
} from "./lib/catalog/pages";
import { tryCatalog, withCatalogErrors } from "./lib/catalog/provider";
import { searchCatalog, searchRemote } from "./lib/catalog/search";
import { genreOptions, recentReleases, topRated, weeklyTrends } from "./lib/discovery";
import { checkHealth } from "./lib/health";
import {
  blindArtistDetail,
  blindReleaseDetail,
  blindSearchResults,
  blindTrackDetail,
} from "./lib/listening/blind";
import {
  createEntry,
  deleteEntry,
  getMyItemState,
  markListened,
  quickLike,
  quickRate,
  updateEntry,
  updateWantToListen,
} from "./lib/listening/entries";
import { createMood, listMoods } from "./lib/listening/moods";
import {
  addListItem,
  createList,
  deleteList,
  getListDetail,
  getMyLists,
  removeListItem,
  reorderList,
  updateList,
} from "./lib/lists";
import { createReview, deleteReview, getMyReview, updateReview } from "./lib/listening/reviews";
import {
  getDiaryMonth,
  getDiaryPage,
  getLikesPage,
  getProfileLists,
  getProfileStats,
  getPublicProfile,
  getReviewsPage,
  getToListenPage,
} from "./lib/profiles";
import { getShelf, removeShelfItem, reorderShelf, setShelfItem } from "./lib/shelf";
import { friendsFeed, popularFeed, suggestedMembers } from "./lib/social/feed";
import { block, follow, followPage, listBlocks, unblock, unfollow } from "./lib/social/follows";
import {
  createComment,
  createReport,
  deleteComment,
  listComments,
  setLike,
  updateComment,
} from "./lib/social/interactions";
import {
  decideReport,
  mySuspension,
  restoreContent,
  suspendMember,
  unsuspendMember,
} from "./lib/moderation/decisions";
import { CONTACT_PLACEHOLDER } from "./lib/moderation/emails";
import { listModerationHistory } from "./lib/moderation/history";
import { listReports, listSuspended } from "./lib/moderation/queue";
import { listNotifications, markAllRead, unreadCount } from "./lib/social/notifications";
import { getReviewDetail } from "./lib/social/reviews";
import type { Viewer } from "./lib/viewer";
import { usernameStatus } from "./lib/usernames";
import {
  accountProcedure,
  adminProcedure,
  createCallerFactory,
  fail,
  protectedProcedure,
  publicProcedure,
  router,
  type Context,
  type SessionUser,
} from "./trpc";

/** Uploads are cheap to abuse: at most 10 per member per hour. */
const AVATAR_UPLOAD_RULE = { window: 60 * 60, max: 10 };
/** MusicBrainz is shared by the whole site (1 request/s): per-member budgets on top. */
const REMOTE_SEARCH_RULE = { window: 60 * 60, max: 60 };
const IMPORT_RULE = { window: 60 * 60, max: 30 };
/** Listening writes (listens, ratings, hearts, queue): generous for people, not for bots. */
const LISTEN_WRITE_RULE = { window: 60 * 60, max: 300 };
const REVIEW_WRITE_RULE = { window: 60 * 60, max: 30 };
const MOOD_CREATE_RULE = { window: 60 * 60, max: 30 };
const SHELF_WRITE_RULE = { window: 60 * 60, max: 120 };
/** Social writes, per member and per hour. */
const FOLLOW_WRITE_RULE = { window: 60 * 60, max: 200 };
const LIKE_WRITE_RULE = { window: 60 * 60, max: 300 };
const COMMENT_WRITE_RULE = { window: 60 * 60, max: 60 };
const BLOCK_WRITE_RULE = { window: 60 * 60, max: 60 };
const REPORT_WRITE_RULE = { window: 60 * 60, max: 20 };
/** List writes (create, edit, add, remove, reorder): one bucket, per member and per hour. */
const LIST_WRITE_RULE = { window: 60 * 60, max: 120 };

/** Spends one write from the member's budget for `bucket`, or fails with RATE_LIMITED. */
async function spend(
  ctx: { db: Context["db"]; user: SessionUser },
  bucket: string,
  rule: { window: number; max: number },
) {
  const limit = await consumeRateLimit(ctx.db(), `${bucket}:${ctx.user.id}`, rule);
  if (!limit.allowed) fail("TOO_MANY_REQUESTS", "RATE_LIMITED");
}

const listenWrite = protectedProcedure.use(async ({ ctx, next }) => {
  await spend(ctx, "listen-write", LISTEN_WRITE_RULE);
  return next();
});
const reviewWrite = protectedProcedure.use(async ({ ctx, next }) => {
  await spend(ctx, "review-write", REVIEW_WRITE_RULE);
  return next();
});

/** Blind listening settings of the caller (null when signed out or not in blind mode). */
/** Who reads (an active member or a visitor) and their blind listening, from `ctx.account()`. */
const viewerOf = async (ctx: Pick<Context, "account">): Promise<Viewer> => {
  const account = await ctx.account();
  if (!account || account.suspendedAt) return { id: null, blind: null };
  const id = account.user.id;
  return { id, blind: account.blindMode ? { userId: id } : null };
};
const blindOf = async (ctx: Pick<Context, "account">) => (await viewerOf(ctx)).blind;

/** Who reads: id and blind listening (both null when signed out). */

/** A signed-in procedure that spends one write from `bucket` first. */
const limitedWrite = (bucket: string, rule: { window: number; max: number }) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    await spend(ctx, bucket, rule);
    return next();
  });

const shelfWrite = limitedWrite("shelf-write", SHELF_WRITE_RULE);
const followWrite = limitedWrite("follow-write", FOLLOW_WRITE_RULE);
const likeWrite = limitedWrite("like-write", LIKE_WRITE_RULE);
const commentWrite = limitedWrite("comment-write", COMMENT_WRITE_RULE);
const blockWrite = limitedWrite("block-write", BLOCK_WRITE_RULE);
const reportWrite = limitedWrite("report-write", REPORT_WRITE_RULE);
const listWrite = limitedWrite("list-write", LIST_WRITE_RULE);

export const appRouter = router({
  system: router({
    health: publicProcedure.query(({ ctx }) => checkHealth(ctx.db())),
  }),
  feed: router({
    /** Activity of the members the caller follows, newest first. */
    friends: protectedProcedure.input(cursorPageSchema).query(async ({ input, ctx }) => {
      const { blind } = await viewerOf(ctx);
      return friendsFeed(ctx.db(), { id: ctx.user.id, blind }, input.cursor);
    }),
    /** Most liked and commented reviews of the week, in one language. */
    popular: publicProcedure
      .input(z.object({ lang: audienceLangSchema, cursor: cursorSchema.optional() }))
      .query(async ({ input, ctx }) =>
        popularFeed(ctx.db(), await viewerOf(ctx), input.lang, input.cursor, ctx.now),
      ),
    /** Active members to follow (shown when the friends feed is empty). */
    suggestions: protectedProcedure.query(({ ctx }) =>
      suggestedMembers(ctx.db(), ctx.user.id, ctx.now),
    ),
  }),
  discovery: router({
    /** The week's trends with members of one interface language (completed when short). */
    trends: publicProcedure
      .input(trendsSchema)
      .query(async ({ input, ctx }) =>
        weeklyTrends(ctx.db(), input.lang, await viewerOf(ctx), ctx.now),
      ),
    /** Albums and EPs (or one type) out in the last 90 days, newest first. */
    recent: publicProcedure
      .input(recentReleasesSchema)
      .query(async ({ input, ctx }) =>
        recentReleases(ctx.db(), await viewerOf(ctx), ctx.now, input.type, input.page),
      ),
    /** Top rated by Bayesian score, by genre and year or decade. */
    topRated: publicProcedure
      .input(topRatedSchema)
      .query(async ({ input, ctx }) => topRated(ctx.db(), await viewerOf(ctx), input)),
    genres: publicProcedure.query(({ ctx }) => genreOptions(ctx.db())),
  }),
  social: router({
    follow: followWrite
      .input(memberSchema)
      .mutation(({ input, ctx }) => follow(ctx.db(), ctx.user.id, input.username, ctx.now)),
    unfollow: followWrite
      .input(memberSchema)
      .mutation(({ input, ctx }) => unfollow(ctx.db(), ctx.user.id, input.username)),
    followers: publicProcedure.input(memberPageSchema).query(async ({ input, ctx }) => {
      const user = await ctx.user();
      return followPage(ctx.db(), input.username, "followers", user?.id ?? null, input.cursor);
    }),
    following: publicProcedure.input(memberPageSchema).query(async ({ input, ctx }) => {
      const user = await ctx.user();
      return followPage(ctx.db(), input.username, "following", user?.id ?? null, input.cursor);
    }),
  }),
  like: router({
    set: likeWrite
      .input(likeSetSchema)
      .mutation(({ input, ctx }) =>
        setLike(ctx.db(), ctx.user.id, input.subject, input.liked, ctx.now),
      ),
  }),
  comment: router({
    list: publicProcedure.input(commentListSchema).query(async ({ input, ctx }) => {
      const user = await ctx.user();
      return listComments(ctx.db(), input.subject, user?.id ?? null, input.cursor);
    }),
    create: commentWrite
      .input(commentCreateSchema)
      .mutation(({ input, ctx }) =>
        createComment(ctx.db(), ctx.user.id, input.subject, input.body, ctx.now),
      ),
    update: commentWrite
      .input(commentUpdateSchema)
      .mutation(({ input, ctx }) =>
        updateComment(ctx.db(), ctx.user.id, input.id, input.body, ctx.now),
      ),
    delete: commentWrite
      .input(z.object({ id: z.uuid() }))
      .mutation(({ input, ctx }) => deleteComment(ctx.db(), ctx.user.id, input.id, ctx.now)),
  }),
  notification: router({
    list: protectedProcedure
      .input(cursorPageSchema)
      .query(({ input, ctx }) =>
        listNotifications(
          ctx.db(),
          ctx.user.id,
          input.cursor,
          ctx.contactEmail ?? CONTACT_PLACEHOLDER,
        ),
      ),
    /** Unread groups, for the header badge (0 when signed out). */
    unreadCount: publicProcedure.query(async ({ ctx }) => {
      const user = await ctx.user();
      return user ? unreadCount(ctx.db(), user.id) : 0;
    }),
    markAllRead: protectedProcedure.mutation(({ ctx }) =>
      markAllRead(ctx.db(), ctx.user.id, ctx.now),
    ),
  }),
  block: router({
    add: blockWrite
      .input(memberSchema)
      .mutation(({ input, ctx }) => block(ctx.db(), ctx.user.id, input.username, ctx.now)),
    remove: blockWrite
      .input(memberSchema)
      .mutation(({ input, ctx }) => unblock(ctx.db(), ctx.user.id, input.username)),
    list: protectedProcedure.query(({ ctx }) => listBlocks(ctx.db(), ctx.user.id)),
  }),
  report: router({
    create: reportWrite
      .input(reportCreateSchema)
      .mutation(({ input, ctx }) => createReport(ctx.db(), ctx.user.id, input, ctx.now)),
  }),
  release: router({
    /** A stub (known from a discography only) is completed when a member opens it. */
    bySlug: publicProcedure.input(z.object({ slug: slugSchema })).query(async ({ input, ctx }) => {
      const found = await releaseIdBySlug(ctx.db(), input.slug);
      if (!found) return null;
      const user = found.mbid && !found.tracklistImportedAt ? await ctx.user() : null;
      if (user && found.mbid) {
        const mbid = found.mbid;
        await tryCatalog(() =>
          importReleaseGroup(ctx.db(), ctx.catalog(), mbid, { requestedById: user.id }),
        );
      }
      const viewer = await viewerOf(ctx);
      const detail = await getReleaseDetail(ctx.db(), input.slug, viewer.id);
      return detail && blindReleaseDetail(ctx.db(), viewer.blind, detail);
    }),
  }),
  artist: router({
    /** The discography is imported when a member first opens the page. */
    bySlug: publicProcedure.input(z.object({ slug: slugSchema })).query(async ({ input, ctx }) => {
      const found = await artistIdBySlug(ctx.db(), input.slug);
      if (!found) return null;
      const user = found.mbid && !found.discographyImportedAt ? await ctx.user() : null;
      if (user && found.mbid) {
        const mbid = found.mbid;
        await tryCatalog(() =>
          importArtist(ctx.db(), ctx.catalog(), mbid, { requestedById: user.id }),
        );
      }
      const detail = await getArtistDetail(ctx.db(), input.slug);
      return detail && blindArtistDetail(ctx.db(), await blindOf(ctx), detail);
    }),
  }),
  track: router({
    bySlug: publicProcedure.input(z.object({ slug: slugSchema })).query(async ({ input, ctx }) => {
      const detail = await getTrackDetail(ctx.db(), input.slug);
      return detail && blindTrackDetail(ctx.db(), await blindOf(ctx), detail);
    }),
  }),
  catalog: router({
    /** Local catalog only: instant, public. */
    search: publicProcedure.input(catalogSearchSchema).query(async ({ input, ctx }) => {
      const results = await searchCatalog(ctx.db(), input);
      return blindSearchResults(ctx.db(), await blindOf(ctx), results);
    }),
    /** MusicBrainz search, for members, when the local catalog lacks something. */
    searchRemote: protectedProcedure.input(catalogSearchSchema).query(async ({ input, ctx }) => {
      const key = `catalog-search:${ctx.user.id}`;
      const limit = await consumeRateLimit(ctx.db(), key, REMOTE_SEARCH_RULE);
      if (!limit.allowed) fail("TOO_MANY_REQUESTS", "RATE_LIMITED");
      return withCatalogErrors(() => searchRemote(ctx.db(), ctx.catalog(), input));
    }),
    /** Imports a MusicBrainz entity once and for all; returns where to find it. */
    import: protectedProcedure.input(catalogImportSchema).mutation(async ({ input, ctx }) => {
      const key = `catalog-import:${ctx.user.id}`;
      const limit = await consumeRateLimit(ctx.db(), key, IMPORT_RULE);
      if (!limit.allowed) fail("TOO_MANY_REQUESTS", "RATE_LIMITED");
      const options = { requestedById: ctx.user.id };
      const slug = await withCatalogErrors(() =>
        importEntity(ctx.db(), ctx.catalog(), input.kind, input.mbid, options),
      );
      return { kind: input.kind, slug };
    }),
  }),
  profile: router({
    /** Header, Shelf and recent activity; each section below is its own call. */
    byUsername: publicProcedure
      .input(z.object({ username: usernameSchema }))
      .query(async ({ input, ctx }) =>
        getPublicProfile(ctx.db(), input.username, await viewerOf(ctx)),
      ),
    diary: publicProcedure
      .input(profilePageSchema)
      .query(async ({ input, ctx }) =>
        getDiaryPage(ctx.db(), input.username, await viewerOf(ctx), input.page),
      ),
    /** Calendar view: the dated listens of one month. */
    diaryMonth: publicProcedure
      .input(profileMonthSchema)
      .query(async ({ input, ctx }) =>
        getDiaryMonth(ctx.db(), input.username, await viewerOf(ctx), input.month),
      ),
    likes: publicProcedure
      .input(profilePageSchema)
      .query(async ({ input, ctx }) =>
        getLikesPage(ctx.db(), input.username, await viewerOf(ctx), input.page),
      ),
    reviews: publicProcedure
      .input(profilePageSchema)
      .query(async ({ input, ctx }) =>
        getReviewsPage(ctx.db(), input.username, await viewerOf(ctx), input.page),
      ),
    toListen: publicProcedure
      .input(profilePageSchema)
      .query(async ({ input, ctx }) =>
        getToListenPage(ctx.db(), input.username, await viewerOf(ctx), input.page),
      ),
    lists: publicProcedure
      .input(profilePageSchema)
      .query(async ({ input, ctx }) =>
        getProfileLists(ctx.db(), input.username, await viewerOf(ctx), input.page),
      ),
    /** Null for an unknown member or private stats; cached per member. */
    stats: publicProcedure
      .input(z.object({ username: usernameSchema }))
      .query(async ({ input, ctx }) =>
        getProfileStats(ctx.db(), input.username, await viewerOf(ctx), ctx.now),
      ),
  }),
  list: router({
    /** A list page (null when it does not exist), one page of items at a time. */
    byId: publicProcedure
      .input(listPageSchema)
      .query(async ({ input, ctx }) =>
        getListDetail(ctx.db(), input.id, await viewerOf(ctx), input.page),
      ),
    /** The caller's lists, for the "Add to a list" dialog. */
    mine: protectedProcedure
      .input(myListsSchema)
      .query(({ input, ctx }) => getMyLists(ctx.db(), ctx.user.id, input.target)),
    create: listWrite
      .input(listCreateSchema)
      .mutation(({ input, ctx }) => createList(ctx.db(), ctx.user.id, input)),
    update: listWrite
      .input(listUpdateSchema)
      .mutation(({ input, ctx }) => updateList(ctx.db(), ctx.user.id, input)),
    delete: listWrite
      .input(z.object({ id: z.uuid() }))
      .mutation(({ input, ctx }) => deleteList(ctx.db(), ctx.user.id, input.id)),
    addItem: listWrite
      .input(listItemAddSchema)
      .mutation(({ input, ctx }) => addListItem(ctx.db(), ctx.user.id, input.listId, input.target)),
    removeItem: listWrite
      .input(listItemRemoveSchema)
      .mutation(({ input, ctx }) =>
        removeListItem(ctx.db(), ctx.user.id, input.listId, input.itemId),
      ),
    reorder: listWrite
      .input(listReorderSchema)
      .mutation(({ input, ctx }) =>
        reorderList(ctx.db(), ctx.user.id, input.listId, input.itemIds),
      ),
  }),
  /** The signed-in member's Shelf (4 favourite records). */
  shelf: router({
    mine: protectedProcedure.query(({ ctx }) => getShelf(ctx.db(), ctx.user.id)),
    set: shelfWrite
      .input(shelfSetSchema)
      .mutation(({ input, ctx }) => setShelfItem(ctx.db(), ctx.user.id, input)),
    remove: shelfWrite
      .input(shelfRemoveSchema)
      .mutation(({ input, ctx }) => removeShelfItem(ctx.db(), ctx.user.id, input.position)),
    reorder: shelfWrite
      .input(shelfReorderSchema)
      .mutation(({ input, ctx }) => reorderShelf(ctx.db(), ctx.user.id, input.releaseIds)),
  }),
  listening: router({
    /** The member's state and listens for an item page (null when signed out). */
    myState: publicProcedure.input(listenTargetSchema).query(async ({ input, ctx }) => {
      const user = await ctx.user();
      return user ? getMyItemState(ctx.db(), user.id, input, ctx.now) : null;
    }),
    /** Quick rating (null clears it) on the member's undated listen; `order` drops stale ones. */
    quickRate: listenWrite
      .input(quickRateSchema)
      .mutation(({ input, ctx }) =>
        quickRate(ctx.db(), ctx.user.id, input.target, input.rating, input.order),
      ),
    quickLike: listenWrite
      .input(quickLikeSchema)
      .mutation(({ input, ctx }) => quickLike(ctx.db(), ctx.user.id, input.target, input.liked)),
    /** "I listened" in one click: a dated listen today, in the member's time zone. */
    markListened: listenWrite
      .input(listenTargetSchema)
      .mutation(({ input, ctx }) => markListened(ctx.db(), ctx.user.id, input, ctx.now)),
    setWantToListen: listenWrite
      .input(wantToListenSchema)
      .mutation(({ input, ctx }) =>
        updateWantToListen(ctx.db(), ctx.user.id, input.target, input.wantToListen),
      ),
    entry: router({
      create: listenWrite.input(entryCreateSchema).mutation(async ({ input, ctx }) => {
        if (input.review) await spend(ctx, "review-write", REVIEW_WRITE_RULE);
        return createEntry(ctx.db(), ctx.user.id, input, ctx.now);
      }),
      update: listenWrite
        .input(entryUpdateSchema)
        .mutation(({ input, ctx }) => updateEntry(ctx.db(), ctx.user.id, input, ctx.now)),
      delete: listenWrite
        .input(z.object({ id: z.uuid() }))
        .mutation(({ input, ctx }) => deleteEntry(ctx.db(), ctx.user.id, input.id)),
    }),
    moods: router({
      /** Suggested moods, plus the member's own when signed in. */
      list: publicProcedure.query(async ({ ctx }) => {
        const user = await ctx.user();
        return listMoods(ctx.db(), user?.id ?? null);
      }),
      create: protectedProcedure
        .input(z.object({ label: moodLabelSchema }))
        .mutation(async ({ input, ctx }) => {
          await spend(ctx, "mood-create", MOOD_CREATE_RULE);
          return createMood(ctx.db(), ctx.user.id, input.label);
        }),
    }),
  }),
  review: router({
    /** A review page (null when it does not exist). */
    byId: publicProcedure
      .input(z.object({ id: z.uuid() }))
      .query(async ({ input, ctx }) => getReviewDetail(ctx.db(), input.id, await viewerOf(ctx))),
    /** The caller's own review, for editing (null when missing or someone else's). */
    mine: protectedProcedure
      .input(z.object({ id: z.uuid() }))
      .query(({ input, ctx }) => getMyReview(ctx.db(), ctx.user.id, input.id)),
    create: reviewWrite
      .input(reviewCreateSchema)
      .mutation(({ input, ctx }) => createReview(ctx.db(), ctx.user.id, input)),
    update: reviewWrite
      .input(reviewUpdateSchema)
      .mutation(({ input, ctx }) => updateReview(ctx.db(), ctx.user.id, input)),
    delete: reviewWrite
      .input(z.object({ id: z.uuid() }))
      .mutation(({ input, ctx }) => deleteReview(ctx.db(), ctx.user.id, input.id)),
  }),
  account: router({
    /** Null when signed out; `profile` is null until onboarding is done. */
    me: publicProcedure.query(async ({ ctx }) => {
      const user = await ctx.user();
      if (!user) return null;
      return getMe(ctx.db(), user, ctx.now, (await ctx.account())?.role === "admin");
    }),
    /**
     * The caller's suspension and its reason: null when signed out or not suspended. Only the
     * signed-in member sees it (the sign-in page never tells whether an address is suspended).
     */
    suspension: publicProcedure.query(async ({ ctx }) => {
      const account = await ctx.account();
      return account ? mySuspension(ctx.db(), account, ctx.contactEmail) : null;
    }),
    usernameStatus: protectedProcedure
      .input(z.object({ username: z.string().max(64) }))
      .query(async ({ input, ctx }) => ({
        status: await usernameStatus(ctx.db(), input.username, ctx.user.id, ctx.now),
      })),
    onboard: protectedProcedure
      .input(onboardingSchema)
      .mutation(({ input, ctx }) => onboard(ctx.db(), ctx.user, input, ctx.now)),
    updateProfile: protectedProcedure
      .input(profileUpdateSchema)
      .mutation(({ input, ctx }) => updateProfile(ctx.db(), ctx.user, input)),
    changeUsername: protectedProcedure
      .input(z.object({ username: z.string().max(64) }))
      .mutation(async ({ input, ctx }) => {
        if (!usernameSchema.safeParse(input.username).success) {
          fail("BAD_REQUEST", "USERNAME_INVALID");
        }
        await changeUsername(ctx.db(), ctx.user, input.username, ctx.now);
      }),
    /** Raw image bytes (WebP, PNG or JPEG, ≤ 1 MB), e.g. from `/api/avatar` multipart. */
    setAvatar: protectedProcedure
      .input(z.object({ data: z.instanceof(Uint8Array) }))
      .mutation(async ({ input, ctx }) => {
        const limit = await consumeRateLimit(ctx.db(), `avatar:${ctx.user.id}`, AVATAR_UPLOAD_RULE);
        if (!limit.allowed) fail("TOO_MANY_REQUESTS", "RATE_LIMITED");
        return setAvatar(ctx.db(), ctx.storage(), ctx.user, input.data);
      }),
    removeAvatar: protectedProcedure.mutation(({ ctx }) =>
      removeAvatar(ctx.db(), ctx.storage(), ctx.user),
    ),
    // Data rights stay open to a suspended account.
    export: accountProcedure.query(({ ctx }) => exportAccount(ctx.db(), ctx.user, ctx.now)),
    delete: accountProcedure
      .input(deleteAccountSchema)
      .mutation(({ input, ctx }) =>
        deleteAccount(ctx.db(), ctx.storage(), ctx.user, input.confirmUsername, ctx.now),
      ),
  }),
  admin: router({
    reports: adminProcedure
      .input(reportQueueSchema)
      .query(({ input, ctx }) => listReports(ctx.db(), input)),
    decide: adminProcedure
      .input(reportDecisionSchema)
      .mutation(({ input, ctx }) => decideReport(ctx.db(), ctx, ctx.admin.id, input, ctx.now)),
    suspended: adminProcedure.query(({ ctx }) => listSuspended(ctx.db())),
    suspend: adminProcedure
      .input(memberModerationSchema)
      .mutation(({ input, ctx }) => suspendMember(ctx.db(), ctx, ctx.admin.id, input, ctx.now)),
    unsuspend: adminProcedure
      .input(memberModerationSchema)
      .mutation(({ input, ctx }) => unsuspendMember(ctx.db(), ctx.admin.id, input, ctx.now)),
    restore: adminProcedure
      .input(restoreContentSchema)
      .mutation(({ input, ctx }) => restoreContent(ctx.db(), ctx.admin.id, input, ctx.now)),
    history: adminProcedure
      .input(moderationHistorySchema)
      .query(({ input, ctx }) => listModerationHistory(ctx.db(), input.page)),
  }),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
