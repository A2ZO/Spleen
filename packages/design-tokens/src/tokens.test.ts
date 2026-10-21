import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";
import { buildThemeCss } from "./css";
import { themes } from "./themes";

const AA_TEXT = 4.5;
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

describe.each(Object.entries(themes))("%s theme is AA compliant", (_name, t) => {
  it.each([
    ["fg on bg", t.fg, t.bg, AA_TEXT],
    ["fg on surface", t.fg, t.surface, AA_TEXT],
    ["fg-muted on bg", t["fg-muted"], t.bg, AA_TEXT],
    ["fg-muted on surface", t["fg-muted"], t.surface, AA_TEXT],
    ["link on bg", t.link, t.bg, AA_TEXT],
    ["link on surface", t.link, t.surface, AA_TEXT],
    ["danger on bg", t.danger, t.bg, AA_TEXT],
    ["danger on surface", t.danger, t.surface, AA_TEXT],
    ["accent-fg on accent", t["accent-fg"], t.accent, AA_TEXT],
    ["accent-fg on accent-hover", t["accent-fg"], t["accent-hover"], AA_TEXT],
    ["star on bg", t.star, t.bg, AA_UI],
    ["star on surface", t.star, t.surface, AA_UI],
  ])("%s", (_label, fg, bg, min) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});

describe("generated theme.css", () => {
  it("is in sync with the tokens (run `pnpm --filter @spleen/design-tokens generate`)", () => {
    const onDisk = readFileSync(new URL("../generated/theme.css", import.meta.url), "utf8");
    expect(onDisk.replace(/\r\n/g, "\n")).toBe(buildThemeCss());
  });
});
