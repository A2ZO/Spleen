import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDb, type DbHandle } from "@spleen/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertProductionConfig, googleConfigured, missingProductionVariables } from "./config";
import { createBrevoMailer, createDevMailer, createMailer, parseSender } from "./email";
import { consumeRateLimit, deferSlots, reserveSlot } from "./rate-limit";
import { createLocalStorage, createStorage } from "./storage";

const email = { to: "camille@example.test", subject: "Hi", text: "Text", html: "<p>Html</p>" };

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), "spleen-infra-"));
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("config", () => {
  const complete = {
    NODE_ENV: "production",
    BETTER_AUTH_SECRET: "x",
    BETTER_AUTH_URL: "https://spleen.example",
    BREVO_API_KEY: "x",
    EMAIL_FROM: "Spleen <bonjour@spleen.example>",
    CONTACT_EMAIL: "bonjour@spleen.example",
    S3_ENDPOINT: "https://r2.example",
    S3_BUCKET: "spleen",
    S3_ACCESS_KEY_ID: "x",
    S3_SECRET_ACCESS_KEY: "x",
    S3_PUBLIC_URL: "https://files.spleen.example",
  };

  it("accepts a complete production environment", () => {
    expect(missingProductionVariables(complete)).toEqual([]);
    expect(() => assertProductionConfig(complete)).not.toThrow();
  });

  it("refuses to start production with a missing variable, naming it", () => {
    expect(() => assertProductionConfig({ ...complete, BREVO_API_KEY: " " })).toThrow(
      /BREVO_API_KEY/,
    );
  });

  it("does not require services outside production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });

  it("enables Google only with both credentials", () => {
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "id" })).toBe(false);
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toBe(true);
  });
});

describe("email", () => {
  it("parses the sender", () => {
    expect(parseSender("Spleen <bonjour@spleen.example>")).toEqual({
      name: "Spleen",
      email: "bonjour@spleen.example",
    });
    expect(parseSender('"Spleen" <a@b.c>')).toEqual({ name: "Spleen", email: "a@b.c" });
    expect(parseSender("a@b.c")).toEqual({ email: "a@b.c" });
  });

  it("calls the Brevo API", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const mailer = createBrevoMailer({
      apiKey: "key",
      from: "Spleen <bonjour@spleen.example>",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init! });
        return Response.json({ messageId: "<1>" }, { status: 201 });
      },
    });
    await mailer.send(email);
    expect(calls[0]?.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((calls[0]?.init.headers as Record<string, string>)["api-key"]).toBe("key");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      sender: { name: "Spleen", email: "bonjour@spleen.example" },
      to: [{ email: email.to }],
      subject: "Hi",
      htmlContent: "<p>Html</p>",
      textContent: "Text",
    });
  });

  it("reports a Brevo error without the response body", async () => {
    const mailer = createBrevoMailer({
      apiKey: "key",
      from: "a@b.c",
      fetch: async () =>
        Response.json({ code: "invalid_parameter", message: email.to }, { status: 400 }),
    });
    const error = await mailer.send(email).catch((e: Error) => e);
    expect((error as Error).message).toBe(
      "Brevo rejected the email (HTTP 400, invalid_parameter).",
    );
  });

  it("writes development emails to the outbox and the log", async () => {
    const lines: string[] = [];
    const outboxDir = path.join(tmp, "outbox");
    await createDevMailer({ outboxDir, log: (l) => lines.push(l) }).send(email);
    const [file] = await readdir(outboxDir);
    expect(JSON.parse(await readFile(path.join(outboxDir, file!), "utf8"))).toMatchObject(email);
    expect(lines.join("")).toContain("Text");
  });

  it("never shows a half-written email to a reader polling the outbox", async () => {
    const outboxDir = path.join(tmp, "outbox-polled");
    const mailer = createDevMailer({ outboxDir, log: () => {} });
    const big = { ...email, text: "x".repeat(4_000_000) };
    let sending = true;
    const sent = Promise.all([1, 2, 3].map(() => mailer.send(big))).finally(() => {
      sending = false;
    });
    let reads = 0;
    // Same filter and parse as the e2e helper `magicLinkFor`.
    while (sending || reads === 0) {
      const files = (await readdir(outboxDir).catch(() => [])).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const text = await readFile(path.join(outboxDir, file), "utf8");
        expect(() => JSON.parse(text)).not.toThrow();
        reads++;
      }
      await new Promise((resolve) => setImmediate(resolve));
    }
    await sent;
    expect((await readdir(outboxDir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("never falls back to the dev mailer in production", () => {
    expect(() => createMailer({ NODE_ENV: "production" })).toThrow(/BREVO_API_KEY/);
  });
});

describe("storage", () => {
  it("stores, serves and deletes local files", async () => {
    const storage = createLocalStorage({ dir: path.join(tmp, "uploads") });
    const key = "avatars/u1/abc.webp";
    await storage.put(key, new Uint8Array([1, 2, 3]), "image/webp");
    expect(await storage.read(key)).toEqual(Buffer.from([1, 2, 3]));
    expect(storage.publicUrl(key)).toBe("/api/uploads/avatars/u1/abc.webp");
    expect(storage.keyFromUrl("/api/uploads/avatars/u1/abc.webp")).toBe(key);
    await storage.delete(key);
    expect(await storage.read(key)).toBeNull();
  });

  it("rejects keys that could escape the storage root", async () => {
    const storage = createLocalStorage({ dir: path.join(tmp, "uploads") });
    await expect(storage.put("../evil.webp", new Uint8Array(), "image/webp")).rejects.toThrow();
    expect(await storage.read("avatars/../../.env")).toBeNull();
    expect(storage.keyFromUrl("https://elsewhere.example/a.webp")).toBeNull();
  });

  it("builds public URLs from S3_PUBLIC_URL", () => {
    const storage = createStorage({
      S3_ENDPOINT: "https://r2.example",
      S3_BUCKET: "spleen",
      S3_ACCESS_KEY_ID: "x",
      S3_SECRET_ACCESS_KEY: "x",
      S3_PUBLIC_URL: "https://files.spleen.example",
    });
    expect(storage.publicUrl("avatars/u/a.webp")).toBe(
      "https://files.spleen.example/avatars/u/a.webp",
    );
  });

  it("never falls back to the disk in production", () => {
    expect(() => createStorage({ NODE_ENV: "production" })).toThrow(/S3_/);
  });
});

describe("rate limit", () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = createDb("memory://");
    await handle.migrate();
  }, 60_000);
  afterAll(() => handle.close());

  it("allows up to max requests per window, then reports when to retry", async () => {
    const rule = { window: 60, max: 2 };
    expect(await consumeRateLimit(handle.db, "k", rule)).toEqual({
      allowed: true,
      retryAfter: null,
    });
    expect((await consumeRateLimit(handle.db, "k", rule)).allowed).toBe(true);
    const third = await consumeRateLimit(handle.db, "k", rule);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(third.retryAfter).toBeLessThanOrEqual(60);
    expect((await consumeRateLimit(handle.db, "other", rule)).allowed).toBe(true);
  });

  it("starts a new window once the previous one has elapsed", async () => {
    const rule = { window: 1, max: 1 };
    await consumeRateLimit(handle.db, "short", rule);
    expect((await consumeRateLimit(handle.db, "short", rule)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await consumeRateLimit(handle.db, "short", rule)).allowed).toBe(true);
  });

  it("hands out one global slot per interval, in order, even to concurrent callers", async () => {
    const rule = { intervalMs: 1000, maxWaitMs: 10_000 };
    const waits = await Promise.all(
      Array.from({ length: 4 }, () => reserveSlot(handle.db, "global", rule)),
    );
    const sorted = [...waits].map(Number).sort((a, b) => a - b);
    expect(sorted[0]).toBe(0);
    sorted.slice(1).forEach((wait, i) => {
      expect(wait - sorted[i]!).toBeGreaterThan(900);
      expect(wait - sorted[i]!).toBeLessThan(1100);
    });
  });

  it("refuses a slot when the queue is too long, and backs everyone off", async () => {
    const rule = { intervalMs: 1000, maxWaitMs: 1500 };
    expect(await reserveSlot(handle.db, "busy", rule)).toBe(0);
    expect(await reserveSlot(handle.db, "busy", rule)).toBeGreaterThan(900);
    // The next free slot is 2 s away, beyond the 1.5 s the caller accepts to wait.
    expect(await reserveSlot(handle.db, "busy", rule)).toBeNull();

    await deferSlots(handle.db, "deferred", 30);
    expect(await reserveSlot(handle.db, "deferred", rule)).toBeNull();
    expect(
      await reserveSlot(handle.db, "deferred", { intervalMs: 1000, maxWaitMs: 60_000 }),
    ).toBeGreaterThan(29_000);
  });
});
