import next from "@spleen/config/eslint/next";

const useNavigate =
  "Navigate with useNavigate() from @/i18n/navigation: it feeds the top navigation bar.";

export default [
  ...next,
  {
    // Every navigation from code goes through one hook, so none is missing the bar.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/i18n/use-navigate.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next/navigation", importNames: ["useRouter"], message: useNavigate },
            { name: "next/router", message: useNavigate },
          ],
          patterns: [
            { group: ["**/base-navigation"], importNames: ["useRouter"], message: useNavigate },
          ],
        },
      ],
    },
  },
];
