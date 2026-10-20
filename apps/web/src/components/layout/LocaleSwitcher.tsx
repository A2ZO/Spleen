"use client";

import { locales, type Locale } from "@spleen/i18n";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (locale: Locale) =>
    startTransition(() => router.replace(pathname, { locale, scroll: false }));

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("flex rounded-md border border-border p-0.5", pending && "opacity-60")}
    >
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          aria-label={t(locale)}
          onClick={() => locale !== current && switchTo(locale)}
          className={cn(
            "rounded-[3px] px-2 py-1 font-mono text-xs uppercase transition-colors",
            locale === current ? "bg-surface-raised text-star" : "text-fg-muted hover:text-fg",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
