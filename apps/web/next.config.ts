import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// `<repo>/.env` is loaded by the package scripts (`dotenv -e ../../.env -- next …`) before
// Next starts: Next itself only reads env files from apps/web.
const nextConfig: NextConfig = {
  // Internal packages ship TypeScript sources; Next compiles them.
  transpilePackages: [
    "@spleen/api",
    "@spleen/auth",
    "@spleen/db",
    "@spleen/design-tokens",
    "@spleen/i18n",
    "@spleen/infra",
    "@spleen/validators",
  ],
  // PGlite (local fallback database) loads its WebAssembly files at runtime: keep it unbundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default withNextIntl(nextConfig);
