import { dark } from "./themes";

/*
 * Non-color tokens. Values are plain CSS strings (no web-only syntax such as color-mix or
 * var()) so the Expo app can reuse them as they are. Shadows are the mockups' exact values.
 */

const accentEdge = dark["accent-edge"];
const edge = dark.edge;

export const radius = {
  sm: "6px",
  md: "10px",
  thumb: "12px",
  "thumb-lg": "14px",
  cover: "20px",
  "cover-lg": "28px",
  "card-sm": "22px",
  card: "28px",
  full: "9999px",
} as const;

export const shadow = {
  /** Cards, navigation bar, tab bar: 1 px top sheen + drop shadow. */
  card: "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 20px 30px -18px rgb(0 0 0 / 0.9)",
  cover: "0 22px 30px -16px rgb(0 0 0 / 0.95), 0 2px 6px rgb(0 0 0 / 0.5)",
  "cover-lg": "0 34px 44px -22px rgb(0 0 0 / 0.95), 0 2px 6px rgb(0 0 0 / 0.5)",
  /** The one big lilac block of a page. */
  "accent-block": "inset 0 1px 0 rgb(255 255 255 / 0.4), 0 22px 34px -18px rgb(0 0 0 / 0.9)",
  /** Lilac primary button: sheen, 5 px edge, soft drop shadow; pressed = edge gone. */
  "button-accent": `inset 0 1px 0 rgb(255 255 255 / 0.5), 0 5px 0 ${accentEdge}, 0 14px 22px -8px rgb(0 0 0 / 0.7)`,
  "button-accent-pressed": `inset 0 1px 0 rgb(255 255 255 / 0.5), 0 0 0 ${accentEdge}`,
  /** Dark secondary button: 4 px edge. */
  button: `inset 0 1px 0 rgb(255 255 255 / 0.1), 0 4px 0 ${edge}, 0 10px 16px -8px rgb(0 0 0 / 0.7)`,
  "button-pressed": `inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 0 ${edge}`,
  /** Small dark pills (reactions, avatar): 3 px edge. */
  "button-sm": `inset 0 1px 0 rgb(255 255 255 / 0.1), 0 3px 0 ${edge}`,
  "avatar-accent": `inset 0 1px 0 rgb(255 255 255 / 0.5), 0 4px 0 ${accentEdge}`,
  /** Buttons laid on the lilac block (ink and on-accent). */
  "button-ink":
    "inset 0 1px 0 rgb(255 255 255 / 0.18), 0 5px 0 rgb(23 16 43 / 0.45), 0 14px 20px -8px rgb(23 16 43 / 0.6)",
  "button-on-accent": "inset 0 1px 0 rgb(255 255 255 / 0.5), 0 5px 0 rgb(23 16 43 / 0.45)",
  "button-on-accent-pressed": "inset 0 1px 0 rgb(255 255 255 / 0.5), 0 0 0 rgb(23 16 43 / 0.45)",
} as const;

/** Depth of each button's edge, which is also how far it sinks when pressed. */
export const edgeDepth = {
  primary: "5px",
  secondary: "4px",
  small: "3px",
} as const;

export const fontFamily = {
  display: "Bricolage Grotesque",
  sans: "Geist",
  mono: "Geist Mono",
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
} as const;

export const letterSpacing = {
  tight: "-0.02em",
  tighter: "-0.03em",
  tightest: "-0.04em",
  /** Small uppercase mono labels. */
  label: "0.06em",
} as const;

/** Touch targets. */
export const size = {
  target: "44px",
  "target-primary": "52px",
} as const;

export const motion = {
  /** Small reaction. */
  fast: "150ms",
  /** Big change. */
  base: "300ms",
  slow: "600ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** Spring back up (buttons after a press). */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;
