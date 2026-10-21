import { getAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

/** Better Auth endpoints (magic link, Google, session) for the site and the Expo app. */
const handler = (request: Request) => getAuth().handler(request);

export { handler as GET, handler as POST };
