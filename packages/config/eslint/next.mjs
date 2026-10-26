import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

import base from "./base.mjs";

/** ESLint flat config for Next.js apps: shared base + Next core web vitals. */
export default tseslint.config(
  ...nextVitals,
  ...base,
  { ignores: ["next-env.d.ts", "playwright-report/**", "test-results/**"] },
  {
    // Every page is dynamic (theme cookie), so static params prerender nothing; in
    // `next dev` they make concurrent first renders race on prerender-manifest.json.
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration[id.name='generateStaticParams']",
          message:
            "Pages are dynamic: generateStaticParams prerenders nothing and races in next dev.",
        },
        {
          selector:
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name='generateStaticParams']",
          message:
            "Pages are dynamic: generateStaticParams prerenders nothing and races in next dev.",
        },
      ],
    },
  },
  prettier,
);
