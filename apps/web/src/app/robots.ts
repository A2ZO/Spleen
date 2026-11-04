import { siteUrl } from "@spleen/infra/config";
import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";

/**
 * Crawlers that collect pages to train AI models. They use the site's compute quota without
 * bringing any visitor. Tokens checked on 27 October 2026 in each company's documentation:
 * - GPTBot: OpenAI, training (developers.openai.com/api/docs/bots);
 * - Google-Extended: Google, Gemini training; no effect on Google Search
 *   (developers.google.com/search/docs/crawling-indexing/google-common-crawlers);
 * - ClaudeBot: Anthropic, training (support.claude.com, article 8896518);
 * - Applebot-Extended: Apple, training; no effect on search (support.apple.com/119829);
 * - CCBot: Common Crawl, open dataset used for training (commoncrawl.org/ccbot);
 * - meta-externalagent: Meta, training (developers.facebook.com, web crawlers).
 * Search crawlers and link previews (Googlebot, Bingbot, Applebot, facebookexternalhit…)
 * stay allowed.
 */
export const AI_TRAINING_BOTS = [
  "GPTBot",
  "Google-Extended",
  "ClaudeBot",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
];

/** Areas with nothing to index (also protected on the server). */
const PRIVATE = ["admin", "settings", "notifications", "welcome"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          ...routing.locales.flatMap((locale) => PRIVATE.map((area) => `/${locale}/${area}`)),
        ],
      },
      { userAgent: AI_TRAINING_BOTS, disallow: "/" },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
