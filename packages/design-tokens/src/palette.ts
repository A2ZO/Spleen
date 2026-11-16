/** Brand palette of the "Lilas" design (docs/design/README.md). Raw values, never used directly in UI. */
export const palette = {
  night: "#0E0C12",
  plum: "#18151F",
  dusk: "#2A2536",
  aubergine: "#15121B",
  heather: "#2E2939",
  slate: "#3A3348",
  mist: "#F4F1FA",
  haze: "#BDB6CC",
  lilac: "#B79CFF",
  ink: "#17102B",
  pitch: "#050408",
} as const;

export type PaletteName = keyof typeof palette;
