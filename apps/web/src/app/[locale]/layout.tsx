import "../globals.css";

import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { SuspendedNotice } from "@/components/account/SuspendedNotice";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HydrationMarker } from "@/components/layout/HydrationMarker";
import { ServiceWorker } from "@/components/layout/ServiceWorker";
import { initRouteLocale } from "@/i18n/locale";
import { COVER_ERROR_SCRIPT } from "@/lib/cover-errors";
import { routing } from "@/i18n/routing";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { getApi } from "@/server/api";
import { serviceWorkerDisabled, siteUrl } from "@spleen/infra/config";

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
  const title = `${t("title")} · ${t("tagline")}`;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: title, template: `%s · ${t("title")}` },
    description: t("description"),
    // Installed on an iPhone: its own name, the Apple icon (app/apple-icon.png), a dark status bar.
    appleWebApp: { capable: true, title: t("title"), statusBarStyle: "black" },
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
  // A suspended member who signed in sees why on every page, and nothing else.
  const [t, jar, suspension] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    cookies(),
    getApi().then((api) => api.account.suspension()),
  ]);
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: COVER_ERROR_SCRIPT }} />
      </head>
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
          <ServiceWorker enabled={!serviceWorkerDisabled()} />
          <HydrationMarker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
