import { createDb, eq, schema, sql, type DbHandle } from "@spleen/db";
import type { Email } from "@spleen/infra/email";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuth, getSessionUser, type Auth } from "./auth";

const env = {
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-0123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
};

let handle: DbHandle;
let auth: Auth;
const outbox: Email[] = [];
const mailer = { send: async (email: Email) => void outbox.push(email) };

beforeAll(async () => {
  handle = createDb("memory://");
  await handle.migrate();
  auth = createAuth({ db: handle.db, mailer, env });
}, 60_000);

afterAll(() => handle.close());

/** Requests a magic link and returns the URL found in the email. */
async function requestLink(email: string, locale?: string): Promise<URL> {
  outbox.length = 0;
  await auth.api.signInMagicLink({
    body: { email, callbackURL: "/fr/welcome", ...(locale ? { metadata: { locale } } : {}) },
    headers: new Headers(),
  });
  const link = /https?:\/\/\S+/.exec(outbox[0]!.text)?.[0];
  return new URL(link!);
}

async function verify(url: URL): Promise<Response> {
  return auth.handler(new Request(url));
}

describe("magic link", () => {
  it("signs up a new member and opens a session", async () => {
    const url = await requestLink("camille@example.test", "en");
    expect(outbox[0]?.to).toBe("camille@example.test");
    expect(outbox[0]?.subject).toBe("Your link to sign in to Spleen");
    expect(url.pathname).toBe("/api/auth/magic-link/verify");

    const response = await verify(url);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3000/fr/welcome");
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");

    const user = await getSessionUser(auth, new Headers({ cookie }));
    expect(user?.email).toBe("camille@example.test");
    // Ids come from Postgres (UUID).
    expect(user?.id).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = await handle.db.select().from(schema.user).where(eq(schema.user.id, user!.id));
    expect(row?.emailVerified).toBe(true);
  });

  it("writes the email in French by default", async () => {
    await requestLink("fr@example.test");
    expect(outbox[0]?.subject).toBe("Ton lien pour entrer dans Spleen");
    expect(outbox[0]?.html).toContain('lang="fr"');
  });

  it("works only once and stores only a hash of the token", async () => {
    const url = await requestLink("once@example.test");
    const token = url.searchParams.get("token")!;
    const rows = await handle.db.select().from(schema.verification);
    expect(rows.some((r) => r.identifier.includes(token) || r.value.includes(token))).toBe(false);

    expect((await verify(url)).headers.getSetCookie()).not.toEqual([]);
    const again = await verify(url);
    expect(again.headers.getSetCookie().filter((c) => c.includes("session_token="))).toEqual([]);
  });

  it("signs the same member in again without creating a second user", async () => {
    await verify(await requestLink("camille@example.test"));
    const users = await handle.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, "camille@example.test"));
    expect(users).toHaveLength(1);
  });
});

describe("providers", () => {
  it("offers Google only when it is configured", async () => {
    const google = (a: Auth) =>
      a.handler(
        new Request("http://localhost:3000/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
          body: JSON.stringify({ provider: "google" }),
        }),
      );
    expect((await google(auth)).ok).toBe(false);
    const withGoogle = createAuth({
      db: handle.db,
      mailer,
      env: { ...env, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" },
    });
    const response = await google(withGoogle);
    expect(response.ok).toBe(true);
    expect(((await response.json()) as { url: string }).url).toMatch(
      /^https:\/\/accounts\.google\.com\//,
    );
  });
});

describe("rate limit", () => {
  it("throttles magic-link requests per client", async () => {
    const limited = createAuth({ db: handle.db, mailer, env, rateLimit: true });
    const request = () =>
      limited.handler(
        new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: env.BETTER_AUTH_URL,
            "x-forwarded-for": "203.0.113.7",
          },
          body: JSON.stringify({ email: "spam@example.test" }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await request()).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

/* Sign-in code: the same email as the link, another way to finish the same sign-in. */

const lastCode = () => /\b(\d{3}) (\d{3})\b/.exec(outbox.at(-1)!.text)!.slice(1).join("");

async function signInWithCode(email: string, otp: string, ip = "198.51.100.1"): Promise<Response> {
  return auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email-otp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: env.BETTER_AUTH_URL,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email, otp }),
    }),
  );
}

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

/** Signs in through one path; returns the session's user and its row, or null. */
async function signInThrough(path: "link" | "code", email: string) {
  const url = await requestLink(email);
  const response = path === "link" ? await verify(url) : await signInWithCode(email, lastCode());
  const user = await getSessionUser(auth, new Headers({ cookie: cookieOf(response) }));
  if (!user) return null;
  const [row] = await handle.db.select().from(schema.user).where(eq(schema.user.id, user.id));
  const [session] = await handle.db
    .select()
    .from(schema.session)
    .where(eq(schema.session.userId, user.id))
    .orderBy(sql`${schema.session.createdAt} desc`)
    .limit(1);
  return { user, row: row!, sessionDays: (session!.expiresAt.getTime() - Date.now()) / 86_400_000 };
}

describe("sign-in code", () => {
  it("is in the link's email, under the link, in two groups, never in the subject", async () => {
    for (const [locale, intro] of [
      ["fr", "Dans l'appli Spleen installée"],
      ["en", "Using the Spleen app installed"],
    ] as const) {
      await requestLink("code@example.test", locale);
      const email = outbox.at(-1)!;
      expect(outbox).toHaveLength(1);
      const code = lastCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(email.subject).not.toMatch(/\d/);
      expect(email.text.indexOf(intro)).toBeGreaterThan(email.text.indexOf("http"));
      expect(email.text).toContain(`${code.slice(0, 3)} ${code.slice(3)}`);
      expect(email.html).toContain(`${code.slice(0, 3)} ${code.slice(3)}`);
      expect(email.html).toContain(intro);
    }
  });

  it("gives the same result as the link: sign-up, normalised address, sign-in again, session", async () => {
    const results = [];
    for (const path of ["link", "code"] as const) {
      const email = `Mixed.${path}@Example.TEST`;
      const first = await signInThrough(path, email);
      const again = await signInThrough(path, email.toLowerCase());
      const users = await handle.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, email.toLowerCase()));
      results.push({
        email: first!.user.email === email.toLowerCase(),
        verified: first!.row.emailVerified,
        sameUser: again!.user.id === first!.user.id,
        users: users.length,
        sessionDays: Math.round(first!.sessionDays),
      });
    }
    expect(results[0]).toEqual({
      email: true,
      verified: true,
      sameUser: true,
      users: 1,
      sessionDays: 7,
    });
    expect(results[1]).toEqual(results[0]);
  });

  it("signs a suspended member in the same way (the app then shows the suspension)", async () => {
    for (const path of ["link", "code"] as const) {
      const email = `suspended-${path}@example.test`;
      const first = await signInThrough(path, email);
      await handle.db.insert(schema.profiles).values({
        userId: first!.user.id,
        username: `suspended_${path}`,
        displayName: "Suspendu",
        ageConfirmedAt: new Date(),
        suspendedAt: new Date(),
        suspensionReason: "Spam",
      });
      // Proof of identity works as with the link: the API then answers ACCOUNT_SUSPENDED and
      // the web shows the "account suspended" page (packages/api, apps/web e2e).
      const again = await signInThrough(path, email);
      expect(again?.user.id).toBe(first!.user.id);
    }
  });

  it("dies with a new link, with the link used, and the link dies with the code used", async () => {
    await requestLink("cancel@example.test");
    const oldCode = lastCode();
    await requestLink("cancel@example.test");
    expect((await signInWithCode("cancel@example.test", oldCode)).ok).toBe(false);

    const link = await requestLink("cancel@example.test");
    const code = lastCode();
    expect(cookieOf(await verify(link))).toContain("session_token=");
    expect((await signInWithCode("cancel@example.test", code)).ok).toBe(false);

    const unused = await requestLink("cancel@example.test");
    expect((await signInWithCode("cancel@example.test", lastCode())).ok).toBe(true);
    expect(cookieOf(await verify(unused))).not.toContain("session_token=");
  });

  it("allows 3 wrong tries per code, then the right one fails too", async () => {
    await requestLink("tries@example.test");
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++)
      expect((await signInWithCode("tries@example.test", wrong)).ok).toBe(false);
    expect((await signInWithCode("tries@example.test", code)).ok).toBe(false);
  });

  it("refuses an address after 10 failed codes in the hour, whatever the IP addresses", async () => {
    const email = "target@example.test";
    for (let i = 0; i < 10; i++) {
      await requestLink(email);
      const wrong = lastCode() === "000000" ? "111111" : "000000";
      await signInWithCode(email, wrong, `203.0.113.${i + 10}`);
    }
    await requestLink(email);
    const response = await signInWithCode(email, lastCode(), "192.0.2.99");
    expect(response.status).toBe(429);
    expect(await response.text()).toContain("TOO_MANY_CODE_FAILURES");
  });

  it("never sends a code by a second email: that route answers 404", async () => {
    outbox.length = 0;
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
        body: JSON.stringify({ email: "second@example.test", type: "sign-in" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(outbox).toEqual([]);
  });
});
