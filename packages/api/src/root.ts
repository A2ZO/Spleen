import { consumeRateLimit } from "@spleen/infra/rate-limit";
import {
  catalogImportSchema,
  catalogSearchSchema,
  deleteAccountSchema,
  onboardingSchema,
  profileUpdateSchema,
  slugSchema,
  usernameSchema,
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
import { getPublicProfile } from "./lib/profiles";
import { usernameStatus } from "./lib/usernames";
import { getHomeFeed } from "./mock/repository";
import { createCallerFactory, fail, protectedProcedure, publicProcedure, router } from "./trpc";

/** Uploads are cheap to abuse: at most 10 per member per hour. */
const AVATAR_UPLOAD_RULE = { window: 60 * 60, max: 10 };
/** MusicBrainz is shared by the whole site (1 request/s): per-member budgets on top. */
const REMOTE_SEARCH_RULE = { window: 60 * 60, max: 60 };
const IMPORT_RULE = { window: 60 * 60, max: 30 };

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
      return getReleaseDetail(ctx.db(), input.slug);
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
      return getArtistDetail(ctx.db(), input.slug);
    }),
  }),
  track: router({
    bySlug: publicProcedure
      .input(z.object({ slug: slugSchema }))
      .query(({ input, ctx }) => getTrackDetail(ctx.db(), input.slug)),
  }),
  catalog: router({
    /** Local catalog only: instant, public. */
    search: publicProcedure
      .input(catalogSearchSchema)
      .query(({ input, ctx }) => searchCatalog(ctx.db(), input)),
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
      .query(({ input, ctx }) => getPublicProfile(ctx.db(), input.username, ctx.now)),
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
