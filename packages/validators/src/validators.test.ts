import { describe, expect, it } from "vitest";

import {
  catalogImportSchema,
  catalogSearchSchema,
  isReservedUsername,
  onboardingSchema,
  ratingSchema,
  ratingToStars,
  slugSchema,
  starsToRating,
  usernameSchema,
} from "./index";

describe("rating", () => {
  it("converts stored ratings to stars", () => {
    expect(ratingToStars(1)).toBe(0.5);
    expect(ratingToStars(7)).toBe(3.5);
    expect(ratingToStars(10)).toBe(5);
  });

  it("converts stars back to the nearest valid rating", () => {
    expect(starsToRating(3.5)).toBe(7);
    expect(starsToRating(3.3)).toBe(7);
    expect(starsToRating(0)).toBe(1);
    expect(starsToRating(9)).toBe(10);
  });

  it("only accepts integers from 1 to 10", () => {
    expect(ratingSchema.safeParse(1).success).toBe(true);
    expect(ratingSchema.safeParse(10).success).toBe(true);
    expect(ratingSchema.safeParse(0).success).toBe(false);
    expect(ratingSchema.safeParse(11).success).toBe(false);
    expect(ratingSchema.safeParse(7.5).success).toBe(false);
  });
});

describe("usernameSchema", () => {
  it("normalizes and accepts valid usernames", () => {
    expect(usernameSchema.parse("  NuitBlanche ")).toBe("nuitblanche");
    expect(usernameSchema.parse("vinyl.vince_2")).toBe("vinyl.vince_2");
  });

  it.each(["ab", "with space", ".dot", "dot.", "a..b", "émile", "x".repeat(31)])(
    "rejects %s",
    (value) => {
      expect(usernameSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("slugSchema", () => {
  it("accepts kebab-case and rejects the rest", () => {
    expect(slugSchema.safeParse("nocturnes-pour-pluie-fine").success).toBe(true);
    expect(slugSchema.safeParse("Bad Slug").success).toBe(false);
    expect(slugSchema.safeParse("double--dash").success).toBe(false);
  });
});

describe("reserved usernames", () => {
  it.each(["admin", "Settings", "s.p.l.e.e.n", "sup_port"])("reserves %s", (value) => {
    expect(isReservedUsername(value)).toBe(true);
  });

  it("lets ordinary names through", () => {
    expect(isReservedUsername("nuitblanche")).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const valid = {
    username: "Camille",
    displayName: " Camille ",
    ageConfirmed: true,
    locale: "fr",
    theme: "dark",
  };

  it("normalizes the input", () => {
    expect(onboardingSchema.parse(valid)).toMatchObject({
      username: "camille",
      displayName: "Camille",
    });
  });

  it("requires the age confirmation", () => {
    expect(onboardingSchema.safeParse({ ...valid, ageConfirmed: false }).success).toBe(false);
  });
});

describe("catalog search and import", () => {
  it("trims the query, defaults to every kind and caps the length", () => {
    expect(catalogSearchSchema.parse({ q: "  kind of blue " })).toEqual({
      q: "kind of blue",
      type: "all",
    });
    expect(catalogSearchSchema.safeParse({ q: "   " }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ q: "x".repeat(101) }).success).toBe(false);
    expect(catalogSearchSchema.safeParse({ q: "x", type: "playlist" }).success).toBe(false);
  });

  it("accepts MusicBrainz ids only", () => {
    const mbid = "8e8a594f-2175-38c7-a871-abb68ec363e7";
    expect(catalogImportSchema.safeParse({ kind: "release_group", mbid }).success).toBe(true);
    expect(catalogImportSchema.safeParse({ kind: "release_group", mbid: "x" }).success).toBe(false);
    expect(catalogImportSchema.safeParse({ kind: "label", mbid }).success).toBe(false);
  });
});
