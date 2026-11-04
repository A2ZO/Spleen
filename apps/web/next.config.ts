import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// `<repo>/.env` is loaded by the package scripts (`dotenv -e ../../.env -- next …`) before
// Next starts: Next itself only reads env files from apps/web.
const nextConfig: NextConfig = {
  // Internal packages ship TypeScript sources; Next compiles them.
  transpilePackages: [
    "@spleen/api",
    "@spleen/auth",
    "@spleen/catalog",
    "@spleen/db",
    "@spleen/design-tokens",
    "@spleen/i18n",
    "@spleen/infra",
    "@spleen/validators",
  ],
  // PGlite (local fallback database) loads its WebAssembly files at runtime: keep it unbundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Read with fs by the Open Graph image route: listed so deployments ship it.
  outputFileTracingIncludes: { "/og/**": ["./assets/fonts/**"] },
  // Covers are served unoptimised (see Cover); only Cover Art Archive may be used.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "coverartarchive.org", pathname: "/release-group/**" },
    ],
  },
  // The Content Security Policy is set per request in `src/proxy.ts` (nonce).
  headers: async () => [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }],
};

export default withNextIntl(nextConfig);
