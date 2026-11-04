import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { contentSecurityPolicy, newNonce } from "./lib/security";

const handleI18nRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const csp = contentSecurityPolicy(newNonce());
  // On the request, Next reads the nonce from it; next-intl forwards the request headers.
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", csp);
  const response = handleI18nRouting(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything except API routes, Open Graph images, Next internals and files with an
  // extension (robots.txt, sitemaps, sw.js, offline.html: no HTML rendered by React).
  matcher: "/((?!api|og/|trpc|_next|_vercel|.*\\..*).*)",
};
