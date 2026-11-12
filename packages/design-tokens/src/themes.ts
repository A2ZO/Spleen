import { palette } from "./palette";

/**
 * Semantic color roles. UI code only uses these names. Spleen has a single, dark theme.
 * Derived shades exist where a raw brand color fails WCAG for its role: `border-field`
 * and `star-empty` reach 3:1 (non-text contrast, WCAG 1.4.11) on bg and surface.
 */
export const colorRoles = [
  "bg",
  "surface",
  "surface-raised",
  "surface-alt",
  "border",
  "border-strong",
  "border-field",
  "fg",
  "fg-muted",
  "accent",
  "accent-hover",
  "accent-fg",
  "accent-edge",
  "edge",
  "star",
  "star-empty",
  "link",
  "danger",
] as const;

export type ColorRole = (typeof colorRoles)[number];
export type Theme = Record<ColorRole, string>;

export const dark: Theme = {
  bg: palette.night,
  surface: palette.plum,
  "surface-raised": palette.dusk,
  /** Alternate rows of a list (tracklists). */
  "surface-alt": palette.aubergine,
  border: palette.heather,
  /** Secondary buttons. */
  "border-strong": palette.slate,
  /** Form fields: the closest shade of `border` that reaches 3:1 on bg and surface. */
  "border-field": "#676371",
  fg: palette.mist,
  "fg-muted": palette.haze,
  accent: palette.lilac,
  "accent-hover": "#C8B3FF",
  "accent-fg": palette.ink,
  /** Edge under the lilac button: lilac mixed with 45 % black. */
  "accent-edge": "#65568C",
  /** Edge under dark buttons and avatars. */
  edge: palette.pitch,
  star: palette.lilac,
  /** Outline of an empty star: 3:1 on surface and surface-raised. */
  "star-empty": "#7967A8",
  link: palette.lilac,
  danger: "#FF9EAD",
};

export const themes = { dark } as const;
