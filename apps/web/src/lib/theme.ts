import { defaultTheme, type ThemeName } from "@spleen/design-tokens";

/**
 * Theme preference cookie. Purely functional (UI preference), so exempt from consent;
 * read on the server to render the right theme with no flash and no inline script.
 */
export const THEME_COOKIE = "spleen-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function parseTheme(value: string | undefined): ThemeName {
  return value === "light" || value === "dark" ? value : defaultTheme;
}

export function readTheme(): ThemeName {
  return parseTheme(document.documentElement.dataset.theme);
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}
