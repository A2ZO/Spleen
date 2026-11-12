"use client";

import { locales, type Locale } from "@spleen/i18n";
import { useLocale, useTranslations } from "next-intl";

import { useNavigate, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const current = useLocale();
  const pathname = usePathname();
  const { replace, pending } = useNavigate();

  // Keeps the query (profile tab, page, calendar month): read at click time, so no
  // `useSearchParams` (and no Suspense boundary) is needed.
  const switchTo = (locale: Locale) =>
    replace(`${pathname}${window.location.search}`, { locale, scroll: false });

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "flex rounded-full border border-border bg-surface p-1",
        pending && "opacity-60",
      )}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          onClick={() => locale !== current && switchTo(locale)}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-mono text-xs uppercase transition-colors duration-150 focus-visible:outline-offset-1",
            // Current language: raised pill and lilac letters, not just a lighter fill.
            locale === current
              ? "bg-surface-raised font-medium text-star"
              : "text-fg-muted hover:text-fg",
          )}
        >
          {locale}
          {/* The visible code stays in the accessible name (voice control: "FR"), plus the language. */}
          <span className="sr-only"> {t(locale)}</span>
        </button>
      ))}
    </div>
  );
}
