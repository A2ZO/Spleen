import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { coverSwatches } from "./covers";
import { buildThemeCss } from "./css";
import { dark as t } from "./themes";

const AA_TEXT = 4.5;
/** Large text and non-text contrast (WCAG 1.4.3 large, 1.4.11). */
const AA_UI = 3;

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("rejects invalid colors", () => {
    expect(() => contrastRatio("red", "#FFFFFF")).toThrow();
  });
});

describe("the theme is AA compliant", () => {
  it.each([
    // Text.
    ["fg on bg", t.fg, t.bg, AA_TEXT],
    ["fg on surface", t.fg, t.surface, AA_TEXT],
    ["fg on surface-raised", t.fg, t["surface-raised"], AA_TEXT],
    ["fg on surface-alt", t.fg, t["surface-alt"], AA_TEXT],
    ["fg-muted on bg", t["fg-muted"], t.bg, AA_TEXT],
    ["fg-muted on surface", t["fg-muted"], t.surface, AA_TEXT],
    ["fg-muted on surface-raised", t["fg-muted"], t["surface-raised"], AA_TEXT],
    ["fg-muted on surface-alt", t["fg-muted"], t["surface-alt"], AA_TEXT],
    ["accent on bg (lilac text)", t.accent, t.bg, AA_TEXT],
    ["accent on surface", t.accent, t.surface, AA_TEXT],
    ["link on bg", t.link, t.bg, AA_TEXT],
    ["link on surface", t.link, t.surface, AA_TEXT],
    ["danger on bg", t.danger, t.bg, AA_TEXT],
    ["danger on surface", t.danger, t.surface, AA_TEXT],
    ["accent-fg on accent", t["accent-fg"], t.accent, AA_TEXT],
    ["accent-fg on accent-hover", t["accent-fg"], t["accent-hover"], AA_TEXT],
    ["fg on accent-fg (ink button)", t.fg, t["accent-fg"], AA_TEXT],
    // Non-text (WCAG 1.4.11).
    ["star on bg", t.star, t.bg, AA_UI],
    ["star on surface", t.star, t.surface, AA_UI],
    ["star-empty on surface", t["star-empty"], t.surface, AA_UI],
    ["star-empty on surface-raised", t["star-empty"], t["surface-raised"], AA_UI],
    ["star-empty on bg", t["star-empty"], t.bg, AA_UI],
    ["border-field on bg", t["border-field"], t.bg, AA_UI],
    ["border-field on surface", t["border-field"], t.surface, AA_UI],
    ["active tab (accent) on surface", t.accent, t.surface, AA_UI],
    ["active tab (accent) on bg", t.accent, t.bg, AA_UI],
    ["focus ring (accent) on bg", t.accent, t.bg, AA_UI],
    ["focus ring (accent) on surface", t.accent, t.surface, AA_UI],
    ["focus ring on lilac (accent-fg)", t["accent-fg"], t.accent, AA_UI],
  ])("%s", (_label, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe("generated covers", () => {
  it.each(coverSwatches.map((s, i) => [i, ...s] as const))(
    "swatch %i keeps its title readable",
    (_i, bg, ink) => {
      expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );
});

describe("generated theme.css", () => {
  it("is in sync with the tokens (run `pnpm --filter @spleen/design-tokens generate`)", () => {
    const onDisk = readFileSync(new URL("../generated/theme.css", import.meta.url), "utf8");
    expect(onDisk.replace(/\r\n/g, "\n")).toBe(buildThemeCss());
  });
});
