"use client";

import "./globals.css";

import type { Messages } from "@spleen/i18n";
import { useEffect, useState } from "react";

import { buttonClasses } from "@/components/ui/Button";

type Texts = Messages["errorPage"];

/**
 * Last resort, when the layout itself failed: it replaces the whole page, outside next-intl's
 * provider. The texts load from packages/i18n in the address's language, only when it shows.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [t, setT] = useState<Texts | null>(null);

  useEffect(() => {
    const locale = window.location.pathname.startsWith("/en") ? "en" : "fr";
    const load =
      locale === "en"
        ? import("@spleen/i18n/messages/en.json")
        : import("@spleen/i18n/messages/fr.json");
    void load.then((messages) => {
      setLang(locale);
      setT(messages.default.errorPage);
      document.title = messages.default.errorPage.metaTitle;
    });
  }, []);

  return (
    <html lang={lang}>
      <body className="flex min-h-screen items-center justify-center bg-bg px-4 text-fg">
        {t && (
          <main className="max-w-2xl py-16 text-center">
            <p className="font-display text-[96px] leading-none font-extrabold tracking-[-0.04em] text-fg tabular sm:text-[128px]">
              500
            </p>
            <blockquote className="mt-10 font-display text-2xl leading-snug font-bold tracking-[-0.02em] text-balance sm:text-3xl">
              <p>{t.quoteLine1}</p>
              <p>{t.quoteLine2}</p>
            </blockquote>
            <p className="mt-4 font-mono text-xs tracking-wider text-fg-muted">{t.attribution}</p>
            <h1 className="mt-10 text-fg-muted">{t.body}</h1>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={reset} className={buttonClasses("primary")}>
                {t.retry}
              </button>
              {/* A full load: the layout failed, nothing of the app is reliable here. */}
              <a href={`/${lang}`} className={buttonClasses("secondary")}>
                {t.back}
              </a>
            </div>
            {error.digest && (
              <p className="mt-8 font-mono text-xs text-fg-muted">
                {t.reference.replace("{digest}", error.digest)}
              </p>
            )}
          </main>
        )}
      </body>
    </html>
  );
}
