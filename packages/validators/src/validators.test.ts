import { describe, expect, it } from "vitest";

import { ratingSchema, ratingToStars, slugSchema, starsToRating, usernameSchema } from "./index";

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
