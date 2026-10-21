import { createDb, eq, schema, type DbHandle } from "@spleen/db";
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
