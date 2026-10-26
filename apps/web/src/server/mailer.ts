import "server-only";

import { createMailer, type Mailer } from "@spleen/infra/email";

const globalForMailer = globalThis as typeof globalThis & { spleenMailer?: Mailer };

/** Brevo when configured, the terminal/outbox mailer in development otherwise. */
export function getMailer(): Mailer {
  globalForMailer.spleenMailer ??= createMailer();
  return globalForMailer.spleenMailer;
}
