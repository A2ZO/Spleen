import "../globals.css";

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { SuspendedNotice } from "@/components/account/SuspendedNotice";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { initRouteLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { getApi } from "@/server/api";

import { fraunces, inter, plexMono } from "../fonts";

// No `generateStaticParams` here: reading the theme cookie makes every page dynamic anyway,
// and in `next dev` it makes each first render rewrite `prerender-manifest.json` in place,
// so two routes compiling at once could read it half-written ("Unexpected end of JSON
// input", then a 500). Enforced by the ESLint config (`@spleen/config/eslint/next`).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: { default: `${t("title")} · ${t("tagline")}`, template: `%s · ${t("title")}` },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#15131C",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = initRouteLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "common" });
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  // A suspended member who signed in sees why on every page, and nothing else.
  const suspension = await (await getApi()).account.suspension();

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
          >
            {t("skipToContent")}
          </a>
          <Header minimal={suspension !== null} />
          <main id="main" className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
            {suspension ? <SuspendedNotice suspension={suspension} locale={locale} /> : children}
          </main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
