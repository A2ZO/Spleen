import { appRouter } from "@spleen/api";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { contextFor } from "@/server/api";

export const dynamic = "force-dynamic";

/**
 * tRPC over HTTP, for client components and the Expo app (which sends its session in the
 * Cookie header, see CLAUDE.md). Server components call the router directly via `getApi()`.
 */
const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => contextFor(request.headers),
  });

export { handler as GET, handler as POST };
