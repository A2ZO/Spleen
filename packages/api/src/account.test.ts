import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, schema, seed, type DbHandle } from "@spleen/db";
import { createTestDb } from "@spleen/db/testing";
import { createLocalStorage } from "@spleen/infra/storage";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sniffImageType } from "./lib/account";
import { createCaller } from "./root";
import { createContext, type SessionUser } from "./trpc";

let handle: DbHandle;
let uploadsDir: string;
const day0 = new Date("2026-10-21T12:00:00Z");
const days = (n: number) => new Date(day0.getTime() + n * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  handle = await createTestDb();
  await seed(handle.db);
  uploadsDir = await mkdtemp(path.join(tmpdir(), "spleen-api-"));
}, 60_000);

afterAll(async () => {
  await handle.close();
  await rm(uploadsDir, { recursive: true, force: true });
});

const storage = () => createLocalStorage({ dir: uploadsDir });

function api(user: SessionUser | null, now = day0) {
  return createCaller(createContext({ now, db: () => handle.db, user: async () => user, storage }));
}

async function newUser(email: string): Promise<SessionUser> {
  const [row] = await handle.db
    .insert(schema.user)
    .values({ name: "", email, emailVerified: true })
    .returning();
  return { id: row!.id, email };
}

async function member(username: string): Promise<SessionUser> {
  const user = await newUser(`${username}@example.test`);
  await api(user).account.onboard({
    username,
    displayName: username,
    ageConfirmed: true,
    locale: "fr",
    theme: "dark",
  });
  return user;
}

/** Error code (`TRPCError.message`) thrown by `fn`. */
async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof TRPCError) return error.message;
    throw error;
  }
  throw new Error("expected an error");
}

const statusOf = (user: SessionUser, username: string, now = day0) =>
  api(user, now)
    .account.usernameStatus({ username })
    .then((r) => r.status);

describe("account.me", () => {
  it("is null when signed out", async () => {
    expect(await api(null).account.me()).toBeNull();
  });

  it("has no profile until onboarding", async () => {
    const user = await newUser("fresh@example.test");
    expect(await api(user).account.me()).toEqual({
      userId: user.id,
      email: "fresh@example.test",
      profile: null,
    });
  });

  it("rejects protected procedures when signed out", async () => {
    expect(await errorCode(() => api(null).account.export())).toBe("UNAUTHENTICATED");
  });
});

describe("account.onboard", () => {
  const input = {
    displayName: "Camille",
    ageConfirmed: true as const,
    locale: "en" as const,
    theme: "light" as const,
  };

  it("creates the profile with the age confirmation date", async () => {
    const user = await newUser("camille@example.test");
    await api(user).account.onboard({ ...input, username: "Camille_R" });
    const me = await api(user).account.me();
    expect(me?.profile).toMatchObject({
      username: "camille_r",
      displayName: "Camille",
      locale: "en",
      theme: "light",
      usernameChangeAvailableAt: null,
    });
    const [row] = await handle.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id));
    expect(row?.ageConfirmedAt).toEqual(day0);
  });

  it("refuses a second onboarding", async () => {
    const user = await member("once_only");
    expect(
      await errorCode(() => api(user).account.onboard({ ...input, username: "twice_only" })),
    ).toBe("PROFILE_EXISTS");
  });

  it("refuses taken usernames regardless of case, and reserved words", async () => {
    const user = await newUser("late@example.test");
    expect(
      await errorCode(() => api(user).account.onboard({ ...input, username: "NuitBlanche" })),
    ).toBe("USERNAME_TAKEN");
    expect(await errorCode(() => api(user).account.onboard({ ...input, username: "admin" }))).toBe(
      "USERNAME_RESERVED",
    );
    expect(await statusOf(user, "a")).toBe("invalid");
  });

  it("requires the minimum age confirmation", async () => {
    const user = await newUser("young@example.test");
    await expect(
      api(user).account.onboard({
        ...input,
        username: "too_young",
        ageConfirmed: false as unknown as true,
      }),
    ).rejects.toThrow();
  });
});

describe("account.changeUsername", () => {
  it("renames at most once every 30 days and records the former username", async () => {
    const user = await member("alpha");
    await api(user).account.changeUsername({ username: "alpha_two" });
    expect((await api(user).account.me())?.profile?.usernameChangeAvailableAt).toBe(
      days(30).toISOString(),
    );
    expect(
      await errorCode(() => api(user, days(29)).account.changeUsername({ username: "alpha3" })),
    ).toBe("USERNAME_COOLDOWN");

    await api(user, days(30)).account.changeUsername({ username: "alpha3" });
    const history = await handle.db
      .select({ username: schema.usernameHistory.username })
      .from(schema.usernameHistory)
      .where(eq(schema.usernameHistory.userId, user.id));
    expect(history.map((h) => h.username).sort()).toEqual(["alpha", "alpha_two"]);
  });

  it("keeps a former username reserved for others for 30 days", async () => {
    const owner = await member("beta");
    const other = await member("someone_else");
    await api(owner).account.changeUsername({ username: "beta_new" });

    expect(await statusOf(other, "BETA", days(10))).toBe("reserved");
    expect(await statusOf(owner, "beta", days(10))).toBe("available");
    expect(await statusOf(other, "beta", days(31))).toBe("available");
  });

  it("rejects the current username and invalid ones", async () => {
    const user = await member("gamma_same");
    expect(
      await errorCode(() => api(user).account.changeUsername({ username: "Gamma_Same" })),
    ).toBe("USERNAME_UNCHANGED");
    expect(await errorCode(() => api(user).account.changeUsername({ username: "x" }))).toBe(
      "USERNAME_INVALID",
    );
  });
});

describe("account.updateProfile", () => {
  it("updates the editable fields", async () => {
    const user = await member("editor");
    await api(user).account.updateProfile({
      displayName: "Édith",
      bio: "Du jazz, la nuit.",
      locale: "en",
      theme: "light",
      statsPrivate: true,
      diaryPrivate: true,
      blindMode: true,
      timeZone: "America/Los_Angeles",
    });
    expect((await api(user).account.me())?.profile).toMatchObject({
      timeZone: "America/Los_Angeles",
      displayName: "Édith",
      bio: "Du jazz, la nuit.",
      statsPrivate: true,
      diaryPrivate: true,
      blindMode: true,
    });
    const profile = await api(null).profile.byUsername({ username: "editor" });
    expect(profile?.displayName).toBe("Édith");
    expect(profile?.shelf).toEqual([null, null, null, null]);
  });
});

describe("avatars", () => {
  const webp = (size = 64) => {
    const data = new Uint8Array(size);
    data.set([0x52, 0x49, 0x46, 0x46], 0);
    data.set([0x57, 0x45, 0x42, 0x50], 8);
    return data;
  };

  it("recognises images by their bytes", () => {
    expect(sniffImageType(webp())?.contentType).toBe("image/webp");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImageType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });

  it("stores a new avatar and deletes the previous file", async () => {
    const user = await member("pictured");
    const first = await api(user).account.setAvatar({ data: webp() });
    expect(first.avatarUrl).toMatch(/^\/api\/uploads\/avatars\/[0-9a-f-]+\/[0-9a-f-]+\.webp$/);
    const second = await api(user).account.setAvatar({ data: webp() });
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
    expect(await readdir(path.join(uploadsDir, "avatars", user.id))).toHaveLength(1);
    expect((await api(null).profile.byUsername({ username: "pictured" }))?.avatarUrl).toBe(
      second.avatarUrl,
    );

    await api(user).account.removeAvatar();
    expect(await readdir(path.join(uploadsDir, "avatars", user.id))).toHaveLength(0);
    expect((await api(user).account.me())?.profile?.avatarUrl).toBeNull();
  });

  it("rejects files that are too large or not images", async () => {
    const user = await member("bad_files");
    expect(
      await errorCode(() => api(user).account.setAvatar({ data: webp(1024 * 1024 + 1) })),
    ).toBe("AVATAR_TOO_LARGE");
    expect(
      await errorCode(() =>
        api(user).account.setAvatar({ data: new TextEncoder().encode("<svg onload=x>") }),
      ),
    ).toBe("AVATAR_TYPE");
  });
});

describe("account.export", () => {
  it("returns the member's data without any secret", async () => {
    const user = await member("exporter");
    await handle.db
      .insert(schema.entries)
      .values({ userId: user.id, listenedOn: "2026-10-20", releaseId: (await firstRelease()).id });
    await handle.db
      .insert(schema.account)
      .values({ userId: user.id, accountId: "g-1", providerId: "google", accessToken: "secret" });

    const data = await api(user).account.export();
    expect(data.format).toBe("spleen-export/1");
    expect(data.profile).toMatchObject({ username: "exporter" });
    expect(data.entries).toHaveLength(1);
    expect(data.signInMethods).toEqual([expect.objectContaining({ provider: "google" })]);
    expect(JSON.stringify(data)).not.toContain("secret");
  });
});

async function firstRelease() {
  const [release] = await handle.db.select().from(schema.releases).limit(1);
  return release!;
}

describe("account.delete", () => {
  it("requires typing the username", async () => {
    const user = await member("careful");
    expect(await errorCode(() => api(user).account.delete({ confirmUsername: "nope" }))).toBe(
      "CONFIRMATION_MISMATCH",
    );
  });

  it("erases the member and their data", async () => {
    const user = await member("leaving");
    await api(user).account.setAvatar({
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    await handle.db
      .insert(schema.entries)
      .values({ userId: user.id, listenedOn: "2026-10-20", releaseId: (await firstRelease()).id });

    await api(user).account.delete({ confirmUsername: "Leaving" });

    expect(await handle.db.$count(schema.user, eq(schema.user.id, user.id))).toBe(0);
    expect(await handle.db.$count(schema.entries, eq(schema.entries.userId, user.id))).toBe(0);
    expect(await readdir(path.join(uploadsDir, "avatars", user.id))).toHaveLength(0);
    expect(await api(null).profile.byUsername({ username: "leaving" })).toBeNull();
  });

  it("frees the username of an e2e test account at once", async () => {
    const tester = await newUser("e2e-mvx1abcd@example.test");
    await api(tester).account.onboard({
      username: "e2e_mvx1abcd",
      displayName: "Alice Nocturne",
      ageConfirmed: true,
      locale: "fr",
      theme: "dark",
    });
    await api(tester).account.delete({ confirmUsername: "e2e_mvx1abcd" });
    expect(
      await handle.db.$count(
        schema.usernameHistory,
        eq(schema.usernameHistory.username, "e2e_mvx1abcd"),
      ),
    ).toBe(0);
    expect(await statusOf(await newUser("next@example.test"), "e2e_mvx1abcd")).toBe("available");
  });

  it("keeps the deleted member's usernames reserved for 30 days, anonymously", async () => {
    const leaver = await member("delta");
    await api(leaver).account.changeUsername({ username: "delta_now" });
    await api(leaver, days(1)).account.delete({ confirmUsername: "delta_now" });

    const rows = await handle.db
      .select()
      .from(schema.usernameHistory)
      .where(eq(schema.usernameHistory.username, "delta_now"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();

    const newcomer = await newUser("newcomer@example.test");
    expect(await statusOf(newcomer, "delta_now", days(30))).toBe("reserved");
    expect(await statusOf(newcomer, "delta", days(29))).toBe("reserved");
    expect(
      await errorCode(() =>
        api(newcomer, days(30)).account.onboard({
          username: "delta_now",
          displayName: "New",
          ageConfirmed: true,
          locale: "fr",
          theme: "dark",
        }),
      ),
    ).toBe("USERNAME_RESERVED");

    // 30 days after the deletion the name is free again, and the anonymous rows are purged.
    expect(await statusOf(newcomer, "delta_now", days(32))).toBe("available");
    await api(newcomer, days(32)).account.onboard({
      username: "delta_now",
      displayName: "New",
      ageConfirmed: true,
      locale: "fr",
      theme: "dark",
    });
    const anonymous = await handle.db
      .select()
      .from(schema.usernameHistory)
      .where(eq(schema.usernameHistory.username, "delta_now"));
    expect(anonymous).toHaveLength(0);
  });
});
