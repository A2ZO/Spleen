import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Internal packages ship TypeScript sources; Next compiles them.
  transpilePackages: ["@spleen/api", "@spleen/design-tokens", "@spleen/i18n", "@spleen/validators"],
};

export default withNextIntl(nextConfig);
