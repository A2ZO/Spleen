/** Brand palette from the spec ("cozy & jazzy"). Raw values, never used directly in UI. */
export const palette = {
  ink: "#15131C",
  smoke: "#2A2633",
  velvet: "#6E2335",
  brass: "#C9A25C",
  midnight: "#1E2A44",
  cream: "#F3EAD8",
} as const;

export type PaletteName = keyof typeof palette;
