import type { Locale } from "@spleen/i18n";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { routing } from "./routing";

/** Validates the `[locale]` segment and enables static rendering for this request. */
export function initRouteLocale(value: string): Locale {
  if (!hasLocale(routing.locales, value)) notFound();
  setRequestLocale(value);
  return value;
}

/** Locale for `generateMetadata` (unknown values fall back; the page itself 404s). */
export function metadataLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
