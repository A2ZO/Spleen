import "server-only";

import { siteUrl } from "@spleen/infra/config";

import { routing } from "@/i18n/routing";

/*
 * Sitemaps written by hand (route handlers, no `generateSitemaps`): an index at /sitemap.xml
 * pointing to /sitemaps/static.xml and to /sitemaps/<kind>-<n>.xml, each URL listed in every
 * locale with its hreflang alternates. Only indexable pages (API `seo.sitemap`).
 */

export const SITEMAP_KINDS = ["releases", "artists", "lists", "profiles", "reviews"] as const;
export type SitemapKind = (typeof SITEMAP_KINDS)[number];

/** Public pages that are always indexable. */
export const STATIC_PATHS = ["/", "/discover", "/legal", "/terms", "/privacy"];

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const urlOf = (locale: string, path: string) => `${siteUrl()}/${locale}${path === "/" ? "" : path}`;

/** One `<url>` per locale, each with the alternates of every locale. */
export function urlSet(entries: { path: string; lastModified?: string }[]): string {
  const urls = entries.flatMap(({ path, lastModified }) =>
    routing.locales.map((locale) => {
      const alternates = [
        ...routing.locales.map((l) => [l, urlOf(l, path)] as const),
        ["x-default", urlOf(routing.defaultLocale, path)] as const,
      ]
        .map(
          ([lang, href]) =>
            `<xhtml:link rel="alternate" hreflang="${lang}" href="${escape(href)}"/>`,
        )
        .join("");
      const lastmod = lastModified ? `<lastmod>${lastModified}</lastmod>` : "";
      return `<url><loc>${escape(urlOf(locale, path))}</loc>${lastmod}${alternates}</url>`;
    }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>\n`;
}

export function sitemapIndex(files: string[]): string {
  const items = files
    .map((file) => `<sitemap><loc>${escape(`${siteUrl()}/sitemaps/${file}`)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>\n`;
}

/** Sitemaps change at most a few times a day: an hour in shared caches. */
export const xmlResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
