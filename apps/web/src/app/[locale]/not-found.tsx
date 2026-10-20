import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata() {
  const t = await getTranslations("notFound");
  return { title: t("metaTitle") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <p className="font-mono text-7xl text-star">404</p>
      <figure className="mt-10">
        <blockquote className="font-serif text-2xl leading-snug italic sm:text-3xl">
          <p>{t("quoteLine1")}</p>
          <p>{t("quoteLine2")}</p>
        </blockquote>
        <figcaption className="mt-4 font-mono text-xs tracking-wider text-fg-muted">
          {t("attribution")}
        </figcaption>
      </figure>
      <p className="mt-10 text-fg-muted">{t("body")}</p>
      <ButtonLink href="/" className="mt-8">
        {t("back")}
      </ButtonLink>
    </div>
  );
}
