import "../globals.css";

import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { SuspendedNotice } from "@/components/account/SuspendedNotice";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { HydrationMarker } from "@/components/layout/HydrationMarker";
import { NavigationBar } from "@/components/layout/NavigationBar";
import { TabBar } from "@/components/layout/TabBar";
import { ServiceWorker } from "@/components/layout/ServiceWorker";
import { UndoBanners } from "@/components/layout/UndoBanners";
import { initRouteLocale } from "@/i18n/locale";
import { COVER_ERROR_SCRIPT } from "@/lib/cover-errors";
import { routing } from "@/i18n/routing";
import { getApi } from "@/server/api";
import { palette } from "@spleen/design-tokens";
import { serviceWorkerDisabled, siteUrl } from "@spleen/infra/config";

import { bricolage, geist, geistMono } from "../fonts";
// Reactions and deletions may leave after an internal navigation (`lib/use-instant-writes.ts`,
// `lib/use-undoable-delete.ts`): the Server Action is then posted to the new page, which must
// know it. Imported here, every page does
// (otherwise Next forwards the call to a page that knows it: in dev that answered `{}` and
// saved nothing, `docs/pieges.md`).
import "./list/actions";
import "./listening/actions";
import "./review/actions";
import "./social/actions";

// No `generateStaticParams` here: reading the session (suspension, header) makes every page
// dynamic anyway,
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
  themeColor: palette.night,
  // `cover`: `env(safe-area-inset-bottom)` is the iPhone's home bar (the tab bar sits above
  // it). `resizes-content`: Android shrinks the page for the keyboard instead of covering it.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
  const [t, suspension] = await Promise.all([
    getTranslations({ locale, namespace: "common" }),
    getApi().then((api) => api.account.suspension()),
  ]);

  return (
    <html lang={locale} className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COVER_ERROR_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only on-accent focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:bg-accent focus:px-5 focus:font-semibold focus:text-accent-fg"
          >
            {t("skipToContent")}
          </a>
          <NavigationBar />
          <Header minimal={suspension !== null} />
          {/* Focusable from code: where the focus goes when its element disappears (`UndoBanners`). */}
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto max-w-6xl px-4 pt-8 outline-none sm:px-6 sm:pt-12"
          >
            {suspension ? <SuspendedNotice suspension={suspension} locale={locale} /> : children}
          </main>
          <Footer />
          {suspension ? null : <TabBar />}
          <UndoBanners />
          <ServiceWorker enabled={!serviceWorkerDisabled()} />
          <HydrationMarker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
