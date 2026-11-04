/*
 * Security headers. The Content Security Policy carries a fresh nonce per request (set in
 * `proxy.ts`): Next reads it from the request header and puts it on its own scripts. Every
 * page is dynamic anyway (theme cookie); the hybrid policy for cached public pages comes with
 * issue #22.
 */

import { createHash } from "node:crypto";

import { COVER_ERROR_SCRIPT } from "./cover-errors";

/**
 * Cover Art Archive redirects to archive.org, which redirects to a mirror (`ia….archive.org`):
 * `*.archive.org` does not match the bare domain, both are needed.
 */
const COVER_HOSTS = ["https://coverartarchive.org", "https://archive.org", "https://*.archive.org"];

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * The inline script of the root layout, allowed by its hash. Never in the static policy of
 * cached pages (issue #22): any hash there makes the browser ignore `'unsafe-inline'`.
 */
const COVER_ERROR_SCRIPT_HASH = `'sha256-${createHash("sha256").update(COVER_ERROR_SCRIPT).digest("base64")}'`;

export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  // Avatars: `/api/uploads` locally, the public R2 bucket URL in production.
  const uploads = origin(process.env.S3_PUBLIC_URL);
  const directives = {
    "default-src": ["'self'"],
    // React needs eval in development only (server error stacks in the browser).
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      COVER_ERROR_SCRIPT_HASH,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // React `style` attributes cannot carry a nonce.
    "style-src": ["'self'", "'unsafe-inline'"],
    // data: and blob: for images made in the browser (canvas, files picked locally).
    "img-src": ["'self'", "data:", "blob:", ...COVER_HOSTS, ...(uploads ? [uploads] : [])],
    "connect-src": ["'self'"],
    "font-src": ["'self'"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** Headers for every response, pages, files and API alike (`next.config.ts`). */
export const STATIC_SECURITY_HEADERS = [
  // No `includeSubDomains` / `preload` until the domain and its subdomains are known.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];
