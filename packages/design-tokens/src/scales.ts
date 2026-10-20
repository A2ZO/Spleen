/** Non-color tokens. Values are plain CSS strings so NativeWind can reuse them later. */
export const radius = {
  sm: "2px",
  md: "4px",
  lg: "8px",
  full: "9999px",
} as const;

export const shadow = {
  cover: "0 10px 24px -8px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.35)",
  card: "0 1px 2px rgb(0 0 0 / 0.25), 0 8px 24px -12px rgb(0 0 0 / 0.4)",
  shelf: "0 14px 18px -10px rgb(0 0 0 / 0.6)",
} as const;

export const fontFamily = {
  serif: "Fraunces",
  sans: "Inter",
  mono: "IBM Plex Mono",
} as const;

export const motion = {
  fast: "150ms",
  base: "300ms",
  slow: "600ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;
