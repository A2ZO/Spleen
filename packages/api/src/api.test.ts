import { seed, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { loadMessages, locales } from "@spleen/i18n";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { API_ERROR_CODES } from "./errors";
import { buildListenLinks } from "./lib/listen-links";
import { averageFromDistribution } from "./lib/ratings";
import { createCaller } from "./root";
import { createContext } from "./trpc";

const now = new Date("2026-10-20T12:00:00Z");

describe("system.health", () => {
  it("queries the database", async () => {
    const handle = await createTestDb();
    try {
      const health = createCaller(createContext({ db: () => handle.db })).system.health();
      expect(await health).toEqual({ ok: true, releases: 0 });
    } finally {
      await handle.close();
    }
  }, 60_000);
});

describe("profile.byUsername", () => {
  let handle: DbHandle;
  let caller: ReturnType<typeof createCaller>;
  beforeAll(async () => {
    handle = await createTestDb();
    await seed(handle.db);
    caller = createCaller(createContext({ now, db: () => handle.db }));
  }, 60_000);
  afterAll(() => handle.close());

  it("returns a profile with a 4-slot shelf and recent activity", async () => {
    const profile = await caller.profile.byUsername({ username: "NuitBlanche" });
    expect(profile?.shelf).toHaveLength(4);
    expect(profile?.shelf.every(Boolean)).toBe(true);
    expect(profile?.recent).toHaveLength(5);
    expect(profile?.recent[0]?.listenedOn).toBe("2026-10-18");
    expect(profile?.isOwner).toBe(false);
    const stats = await caller.profile.stats({ username: "nuitblanche" });
    expect(stats?.base.year).toBe(2026);
  });

  it("fills empty shelf slots with null", async () => {
    const profile = await caller.profile.byUsername({ username: "rainydaysam" });
    expect(profile?.shelf).toEqual([null, null, null, null]);
  });

  it("returns null for an unknown member", async () => {
    expect(await caller.profile.byUsername({ username: "nobody_here" })).toBeNull();
    expect(await caller.profile.exists({ username: "nobody_here" })).toBe(false);
    expect(await caller.profile.exists({ username: "RainyDaySam" })).toBe(true);
  });
});

describe("averageFromDistribution", () => {
  it("computes a weighted mean on the 1..10 scale", () => {
    expect(averageFromDistribution([0, 0, 0, 0, 0, 0, 0, 0, 0, 2])).toBe(10);
    expect(averageFromDistribution([1, 0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe(5.5);
    expect(averageFromDistribution(Array(10).fill(0))).toBeNull();
  });
});

describe("buildListenLinks", () => {
  it("builds encoded search URLs", () => {
    const [spotify] = buildListenLinks("Café crème", ["Quartet Sépia"]);
    expect(spotify?.url).toBe(
      "https://open.spotify.com/search/Quartet%20S%C3%A9pia%20Caf%C3%A9%20cr%C3%A8me",
    );
  });
});

describe("error codes", () => {
  it("all have a message in both languages", async () => {
    for (const locale of locales) {
      const messages = await loadMessages(locale);
      for (const code of API_ERROR_CODES) expect(messages.errors[code]).toBeTruthy();
    }
  });
});
