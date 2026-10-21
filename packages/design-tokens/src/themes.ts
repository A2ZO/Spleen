import { palette } from "./palette";

/**
 * Semantic color roles. UI code only uses these names; each theme maps them to a value.
 * Derived shades exist where a raw brand color fails WCAG AA for its role
 * (brass on cream, midnight as link text on ink).
 */
export const colorRoles = [
  "bg",
  "surface",
  "surface-raised",
  "border",
  "fg",
  "fg-muted",
  "accent",
  "accent-hover",
  "accent-fg",
  "star",
  "link",
  "danger",
  "midnight",
  "wood",
  "wood-dark",
  "vinyl",
  "vinyl-groove",
] as const;

export type ColorRole = (typeof colorRoles)[number];
export type Theme = Record<ColorRole, string>;

export const dark: Theme = {
  bg: palette.ink,
  surface: palette.smoke,
  "surface-raised": "#36313F",
  border: "#423C4E",
  fg: palette.cream,
  "fg-muted": "#BDB3A1",
  accent: palette.velvet,
  "accent-hover": "#852B41",
  "accent-fg": palette.cream,
  star: palette.brass,
  link: "#A9BCE3",
  danger: "#F0A8A8",
  midnight: palette.midnight,
  wood: "#5A3B26",
  "wood-dark": "#3B2618",
  vinyl: "#0D0C10",
  "vinyl-groove": "#2E2A35",
};

export const light: Theme = {
  bg: palette.cream,
  surface: "#FBF6EC",
  "surface-raised": "#FFFFFF",
  border: "#DCCFB6",
  fg: palette.ink,
  "fg-muted": "#5C5446",
  accent: palette.velvet,
  "accent-hover": "#581B2A",
  "accent-fg": palette.cream,
  star: "#7A5B22",
  link: palette.midnight,
  danger: "#8E1F2B",
  midnight: palette.midnight,
  wood: "#8A5E3C",
  "wood-dark": "#6B4529",
  vinyl: "#0D0C10",
  "vinyl-groove": "#2E2A35",
};

export const themes = { dark, light } as const;
export type ThemeName = keyof typeof themes;
export const defaultTheme: ThemeName = "dark";
