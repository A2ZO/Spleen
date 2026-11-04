import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { emailConfigured, isProduction } from "./config";
import { devOutboxDir } from "./paths";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Transactional email sender. Brevo in production; swap providers by adding a mailer. */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/** `"Spleen <bonjour@example.com>"` or `"bonjour@example.com"` → Brevo sender object. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1]!.replace(/^"|"$/g, "");
  return name ? { name, email: match[2]!.trim() } : { email: match[2]!.trim() };
}

export function createBrevoMailer(options: {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}): Mailer {
  const doFetch = options.fetch ?? fetch;
  const sender = parseSender(options.from);
  return {
    async send(email) {
      const response = await doFetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": options.apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: email.to }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
        }),
      });
      if (!response.ok) {
        // Only the status and Brevo's error code: the body may echo the recipient.
        const code = await response
          .json()
          .then((body) => (body as { code?: string }).code)
          .catch(() => undefined);
        throw new Error(
          `Brevo rejected the email (HTTP ${response.status}${code ? `, ${code}` : ""}).`,
        );
      }
    },
  };
}

/**
 * Development substitute: prints the email in the terminal and keeps a JSON copy in
 * `.data/outbox/` (read by the e2e tests to follow magic links).
 */
export function createDevMailer(
  options: { outboxDir?: string; log?: (line: string) => void } = {},
): Mailer {
  const outboxDir = options.outboxDir ?? devOutboxDir;
  const log = options.log ?? ((line: string) => console.info(line));
  return {
    async send(email) {
      log(`\n[dev mail] to ${email.to} — ${email.subject}\n${email.text}\n`);
      await mkdir(outboxDir, { recursive: true });
      const file = path.join(
        outboxDir,
        `${Date.now()}-${email.to.replace(/[^a-z0-9@._-]/gi, "_")}.json`,
      );
      // Written aside then renamed: a reader polling the outbox (e2e) never sees half a file.
      const partial = `${file}.${randomUUID()}.tmp`;
      await writeFile(
        partial,
        JSON.stringify({ ...email, sentAt: new Date().toISOString() }, null, 2),
      );
      await rename(partial, file);
    },
  };
}

/** Brevo when configured; the dev mailer otherwise, except in production. */
export function createMailer(env: Record<string, string | undefined> = process.env): Mailer {
  if (emailConfigured(env)) {
    return createBrevoMailer({ apiKey: env.BREVO_API_KEY!, from: env.EMAIL_FROM! });
  }
  if (isProduction(env)) {
    throw new Error("BREVO_API_KEY and EMAIL_FROM are required in production.");
  }
  return createDevMailer();
}
