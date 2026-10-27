import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Open Graph images, Next internals and files with an
  // extension (robots.txt, sitemaps).
  matcher: "/((?!api|og/|trpc|_next|_vercel|.*\\..*).*)",
};
