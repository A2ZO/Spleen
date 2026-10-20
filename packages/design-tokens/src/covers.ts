import { palette } from "./palette";

/**
 * Color triplets [background, ink, accent] for generated placeholder covers,
 * used whenever a release has no Cover Art Archive image.
 */
export const coverSwatches: readonly (readonly [string, string, string])[] = [
  [palette.midnight, palette.cream, palette.brass],
  [palette.velvet, palette.cream, palette.brass],
  [palette.cream, palette.ink, palette.velvet],
  [palette.brass, palette.ink, palette.velvet],
  [palette.smoke, palette.cream, palette.brass],
  ["#2F4A3A", palette.cream, palette.brass],
  ["#C7B79A", palette.ink, palette.midnight],
  [palette.ink, palette.cream, palette.velvet],
];
