/*
 * Which external services are configured. Without them, development falls back to local
 * substitutes (magic links in the terminal, files on disk); production refuses to start
 * instead of silently using a fallback.
 */

type Env = Record<string, string | undefined>;

const set = (env: Env, name: string) => !!env[name]?.trim();

export const S3_VARIABLES = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_URL",
] as const;

export const isProduction = (env: Env = process.env) => env.NODE_ENV === "production";

export const emailConfigured = (env: Env = process.env) =>
  set(env, "BREVO_API_KEY") && set(env, "EMAIL_FROM");

export const s3Configured = (env: Env = process.env) =>
  S3_VARIABLES.every((name) => set(env, name));

export const googleConfigured = (env: Env = process.env) =>
  set(env, "GOOGLE_CLIENT_ID") && set(env, "GOOGLE_CLIENT_SECRET");

/** Where members write to contest a moderation decision (legal pages, suspension notices). */
export const contactEmail = (env: Env = process.env): string | null =>
  env.CONTACT_EMAIL?.trim() || null;

/** Names (never values) of the variables production needs but lacks. */
export function missingProductionVariables(env: Env = process.env): string[] {
  const required = [
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "BREVO_API_KEY",
    "EMAIL_FROM",
    "CONTACT_EMAIL",
    ...S3_VARIABLES,
  ];
  return required.filter((name) => !set(env, name));
}

/** Throws at server start in production when a required variable is missing. */
export function assertProductionConfig(env: Env = process.env): void {
  if (!isProduction(env)) return;
  const missing = missingProductionVariables(env);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables for production: ${missing.join(", ")}.`);
  }
}
