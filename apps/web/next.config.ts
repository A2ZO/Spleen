import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// `<repo>/.env` is loaded by the package scripts (`dotenv -e ../../.env -- next …`) before
// Next starts: Next itself only reads env files from apps/web.
// Build number in the service worker's cache name: the commit on Vercel, else the build time.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  (process.env.NODE_ENV === "production" ? Date.now().toString(36) : "dev");

const nextConfig: NextConfig = {
  env: { SPLEEN_BUILD_ID: buildId },
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
};

export default withNextIntl(nextConfig);
