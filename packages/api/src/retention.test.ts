import { eq, schema, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { consumeRateLimit } from "@spleen/infra/rate-limit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MUSICBRAINZ_GATE } from "./lib/catalog/provider";
import { runRetention } from "./lib/retention";

/* Nightly retention rules, one test each (the moderation rules live in moderation.test.ts). */

let handle: DbHandle;
const now = new Date("2026-10-27T03:17:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
const db = () => handle.db;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

async function member() {
  const [row] = await db()
    .insert(schema.user)
    .values({ name: "", email: `r${crypto.randomUUID().slice(0, 8)}@example.test` })
    .returning();
  return row!.id;
}

describe("retention", () => {
  it("deletes expired sessions (with their IP address and browser), keeps live ones", async () => {
    const userId = await member();
    await db()
      .insert(schema.session)
      .values([
        { userId, token: "expired", expiresAt: hoursAgo(1), ipAddress: "203.0.113.7" },
        { userId, token: "live", expiresAt: hoursAgo(-24), ipAddress: "203.0.113.8" },
      ]);
    const done = await runRetention(db(), now);
    expect(done.sessions).toBe(1);
    const left = await db().select({ token: schema.session.token }).from(schema.session);
    expect(left).toEqual([{ token: "live" }]);
  });

  it("deletes expired sign-in links and codes, keeps those still valid", async () => {
    await db()
      .insert(schema.verification)
      .values([
        { identifier: "magic-link:old", value: "{}", expiresAt: hoursAgo(1) },
        // Sign-in codes live in the same table (Better Auth email OTP).
        { identifier: "sign-in-otp-old@example.test", value: "hashed:0", expiresAt: hoursAgo(1) },
        { identifier: "magic-link:new", value: "{}", expiresAt: hoursAgo(-0.25) },
      ]);
    expect((await runRetention(db(), now)).verifications).toBe(2);
    const left = await db()
      .select({ identifier: schema.verification.identifier })
      .from(schema.verification);
    expect(left).toEqual([{ identifier: "magic-link:new" }]);
  });

  it("deletes anti-abuse counters 24 hours after their window, never the MusicBrainz gate", async () => {
    await db()
      .insert(schema.rateLimits)
      .values([
        // An hour-long window that ended 24 h and a minute ago: gone.
        { key: "auth:203.0.113.9/sign-in/magic-link", windowStart: hoursAgo(25.02), count: 3 },
        // Ended 23 hours ago: kept.
        { key: "review-write:someone", windowStart: hoursAgo(24), count: 2 },
        // The gate keeps its reservation time, however old its row.
        { key: MUSICBRAINZ_GATE, windowStart: hoursAgo(24 * 90), nextAllowedAt: hoursAgo(1) },
      ]);
    expect((await runRetention(db(), now)).rateLimits).toBe(1);
    const left = await db()
      .select({ key: schema.rateLimits.key })
      .from(schema.rateLimits)
      .orderBy(schema.rateLimits.key);
    expect(left).toEqual([{ key: MUSICBRAINZ_GATE }, { key: "review-write:someone" }]);
  });

  it("is idempotent", async () => {
    const again = await runRetention(db(), now);
    expect(again).toMatchObject({ sessions: 0, verifications: 0, rateLimits: 0 });
  });

  it("refuses a rate limit window longer than the purge allows", async () => {
    await expect(consumeRateLimit(db(), "too-long", { window: 2 * 3600, max: 1 })).rejects.toThrow(
      /window/,
    );
    expect(await db().$count(schema.rateLimits, eq(schema.rateLimits.key, "too-long"))).toBe(0);
  });
});
