"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * A page that failed on the server or in the browser (500), inside the site's layout: a nod to
 * Baudelaire, a retry, and the error's digest to quote when writing to us (never its message).
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    document.title = t("metaTitle");
  }, [t]);

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <p className="font-display text-[96px] leading-none font-extrabold tracking-[-0.04em] text-star tabular sm:text-[128px]">
        500
      </p>
      <figure className="mt-10">
        <blockquote className="font-display text-2xl leading-snug font-bold tracking-[-0.02em] text-balance sm:text-3xl">
          <p>{t("quoteLine1")}</p>
          <p>{t("quoteLine2")}</p>
        </blockquote>
        <figcaption className="mt-4 font-mono text-xs tracking-wider text-fg-muted">
          {t("attribution")}
        </figcaption>
      </figure>
      <h1 className="mt-10 text-fg-muted">{t("body")}</h1>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <ButtonLink href="/" variant="outline">
          {t("back")}
        </ButtonLink>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-xs text-fg-muted">
          {t("reference", { digest: error.digest })}
        </p>
      )}
    </div>
  );
}
