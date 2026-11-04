import "server-only";

import type { Locale } from "@spleen/i18n";
import { siteUrl } from "@spleen/infra/config";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { getPublicApi } from "@/server/api";

/*
 * Search and sharing metadata of a page: canonical and hreflang links (FR / EN, from
 * BETTER_AUTH_URL), robots meta, and the Open Graph image. Whether a page may be indexed and
 * whether it has an image comes from the API (`seo.page`, same rule as the sitemap), asked
 * without a session so it never depends on who is looking.
 */

export type SeoSubject = {
  kind: "release" | "artist" | "list" | "profile" | "review";
  key: string;
};

/** Absolute URL of a path without the locale, in `locale`. */
export const localeUrl = (locale: string, path: string) =>
  `${siteUrl()}/${locale}${path === "/" ? "" : path}`;

/** Canonical link and its language versions (x-default: the default locale). */
export function alternatesFor(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: localeUrl(locale, path),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, localeUrl(l, path)])),
      "x-default": localeUrl(routing.defaultLocale, path),
    },
  };
}

/** Pages search engines should not keep (private, thin or personal): links still followed. */
export const NOINDEX: Metadata["robots"] = { index: false, follow: true };

const OG_SIZE = { width: 1200, height: 630 };

/**
 * Metadata shared by every page about `path`: canonical, hreflang, robots and, for a subject
 * with an image, the versioned Open Graph image (its URL changes when the content does).
 */
export async function seoMetadata(
  locale: Locale,
  path: string,
  options: { subject?: SeoSubject; noindex?: boolean; title?: string; description?: string } = {},
): Promise<Metadata> {
  const page = options.subject ? await getPublicApi().seo.page(options.subject) : null;
  const indexable = !options.noindex && (!options.subject || page?.indexable === true);
  const image =
    options.subject && page?.og
      ? {
          url: `${siteUrl()}/og/${options.subject.kind}/${encodeURIComponent(options.subject.key)}?v=${page.og}`,
          ...OG_SIZE,
        }
      : null;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    alternates: alternatesFor(locale, path),
    ...(indexable ? {} : { robots: NOINDEX }),
    // A page's openGraph replaces the layout's: the site name goes with every page.
    openGraph: {
      type: "website",
      siteName: t("title"),
      url: localeUrl(locale, path),
      locale,
      ...(options.title ? { title: options.title } : {}),
      ...(options.description ? { description: options.description } : {}),
      ...(image ? { images: [image] } : {}),
    },
    twitter: image ? { card: "summary_large_image", images: [image.url] } : { card: "summary" },
  };
}
