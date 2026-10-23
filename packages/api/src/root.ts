import { consumeRateLimit } from "@spleen/infra/rate-limit";
import {
  catalogImportSchema,
  catalogSearchSchema,
  deleteAccountSchema,
  entryCreateSchema,
  entryUpdateSchema,
  listenTargetSchema,
  moodLabelSchema,
  onboardingSchema,
  profileUpdateSchema,
  quickLikeSchema,
  quickRateSchema,
  reviewCreateSchema,
  reviewUpdateSchema,
  slugSchema,
  usernameSchema,
  wantToListenSchema,
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
import { checkHealth } from "./lib/health";
import {
  blindArtistDetail,
  blindReleaseDetail,
  blindSearchResults,
  blindTrackDetail,
  blindViewer,
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
import { createReview, deleteReview, updateReview } from "./lib/listening/reviews";
import { getPublicProfile } from "./lib/profiles";
import { usernameStatus } from "./lib/usernames";
import { getHomeFeed } from "./mock/repository";
import {
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
const viewerOf = async (ctx: Context) => blindViewer(ctx.db(), await ctx.user());

export const appRouter = router({
  system: router({
    health: publicProcedure.query(({ ctx }) => checkHealth(ctx.db())),
  }),
  discover: router({
    home: publicProcedure.query(() => getHomeFeed()),
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
      const detail = await getReleaseDetail(ctx.db(), input.slug);
      return detail && blindReleaseDetail(ctx.db(), await viewerOf(ctx), detail);
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
      return detail && blindArtistDetail(ctx.db(), await viewerOf(ctx), detail);
    }),
  }),
  track: router({
    bySlug: publicProcedure.input(z.object({ slug: slugSchema })).query(async ({ input, ctx }) => {
      const detail = await getTrackDetail(ctx.db(), input.slug);
      return detail && blindTrackDetail(ctx.db(), await viewerOf(ctx), detail);
    }),
  }),
  catalog: router({
    /** Local catalog only: instant, public. */
    search: publicProcedure.input(catalogSearchSchema).query(async ({ input, ctx }) => {
      const results = await searchCatalog(ctx.db(), input);
      return blindSearchResults(ctx.db(), await viewerOf(ctx), results);
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
    byUsername: publicProcedure
      .input(z.object({ username: usernameSchema }))
      .query(async ({ input, ctx }) => {
        const viewer = await ctx.user();
        return getPublicProfile(ctx.db(), input.username, ctx.now, viewer?.id ?? null);
      }),
  }),
  listening: router({
    /** The member's state and listens for an item page (null when signed out). */
    myState: publicProcedure.input(listenTargetSchema).query(async ({ input, ctx }) => {
      const user = await ctx.user();
      return user ? getMyItemState(ctx.db(), user.id, input, ctx.now) : null;
    }),
    /** Quick rating (null clears it), kept on the member's single undated listen. */
    quickRate: listenWrite
      .input(quickRateSchema)
      .mutation(({ input, ctx }) => quickRate(ctx.db(), ctx.user.id, input.target, input.rating)),
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
      return user ? getMe(ctx.db(), user, ctx.now) : null;
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
    export: protectedProcedure.query(({ ctx }) => exportAccount(ctx.db(), ctx.user, ctx.now)),
    delete: protectedProcedure
      .input(deleteAccountSchema)
      .mutation(({ input, ctx }) =>
        deleteAccount(ctx.db(), ctx.storage(), ctx.user, input.confirmUsername, ctx.now),
      ),
  }),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
