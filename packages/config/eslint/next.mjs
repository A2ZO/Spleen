import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

import base from "./base.mjs";

/** ESLint flat config for Next.js apps: shared base + Next core web vitals. */
export default tseslint.config(
  ...nextVitals,
  ...base,
  { ignores: ["next-env.d.ts", "playwright-report/**", "test-results/**"] },
  prettier,
);
