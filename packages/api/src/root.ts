import { slugSchema, usernameSchema } from "@spleen/validators";
import { z } from "zod";

import { checkHealth } from "./lib/health";
import { getHomeFeed, getProfileByUsername, getReleaseBySlug } from "./mock/repository";
import { createCallerFactory, publicProcedure, router } from "./trpc";

export const appRouter = router({
  system: router({
    health: publicProcedure.query(({ ctx }) => checkHealth(ctx.db())),
  }),
  discover: router({
    home: publicProcedure.query(() => getHomeFeed()),
  }),
  release: router({
    bySlug: publicProcedure
      .input(z.object({ slug: slugSchema }))
      .query(({ input }) => getReleaseBySlug(input.slug)),
  }),
  profile: router({
    byUsername: publicProcedure
      .input(z.object({ username: usernameSchema }))
      .query(({ input, ctx }) => getProfileByUsername(input.username, ctx.now)),
  }),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
