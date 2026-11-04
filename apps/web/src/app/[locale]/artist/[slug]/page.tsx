import type { ReleaseCard } from "@spleen/api";
import { slugSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import { CatalogNotice } from "@/components/catalog/CatalogNotice";
import { CatalogReportButton } from "@/components/catalog/CatalogReportButton";
import { ListenOn } from "@/components/catalog/ListenOn";
import { AddToListButton } from "@/components/lists/AddToList";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { missingCatalogPage } from "@/lib/catalog-redirect";
import { artistKind } from "@/lib/catalog-labels";
import { seoMetadata } from "@/lib/seo";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const getArtist = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return (await getApi()).artist.bySlug({ slug: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = metadataLocale(rawLocale);
  const artist = await getArtist(slug);
  if (!artist) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const description = t("artist", { name: artist.name });
  return {
    title: artist.name,
    description,
    ...(await seoMetadata(locale, `/artist/${slug}`, {
      subject: { kind: "artist", key: slug },
      page: artist.seo,
      title: artist.name,
      description,
    })),
  };
}

function Discography({
  id,
  title,
  releases,
}: {
  id: string;
  title: string;
  releases: ReleaseCard[];
}) {
  if (releases.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id}>{title}</SectionHeading>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {releases.map((release) => (
          <li key={release.id}>
            <ReleaseTile release={release} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ArtistPage({ params }: Props) {
  const { locale, slug } = await params;
  initRouteLocale(locale);
  const [artist, me, t, uiLocale] = await Promise.all([
    getArtist(slug),
    getApi().then((api) => api.account.me()),
    getTranslations(),
    getLocale(),
  ]);
  if (!artist) return missingCatalogPage("artist", slug, locale);

  const { albums, eps, singles, other } = artist.discography;
  const empty = albums.length + eps.length + singles.length + other.length === 0;
  const signedIn = !!me;
  const country = artist.country
    ? new Intl.DisplayNames([uiLocale], { type: "region" }).of(artist.country)
    : null;
  const kind = artistKind(artist.type);

  return (
    <article className="space-y-14">
      <header className="grid gap-8 md:grid-cols-[1fr_minmax(0,300px)] md:gap-10">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
            {t(`artist.kind.${kind}`)}
            {country && ` · ${country}`}
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-balance sm:text-6xl">
            {artist.name}
          </h1>
          {artist.disambiguation && (
            <p className="mt-2 font-serif text-lg text-fg-muted italic">{artist.disambiguation}</p>
          )}
          {artist.discographyPending && (
            <div className="mt-6 max-w-xl">
              <CatalogNotice
                signedIn={signedIn}
                memberText={t("artist.pendingMember")}
                visitorText={t("artist.pendingVisitor")}
              />
            </div>
          )}
        </div>
        <aside className="space-y-6">
          {me?.profile && (
            <AddToListButton target={{ kind: "artist", id: artist.id }} title={artist.name} />
          )}
          <ListenOn links={artist.listenLinks} />
          {me?.profile && <CatalogReportButton target={{ kind: "artist", id: artist.id }} />}
        </aside>
      </header>

      {empty && <p className="font-serif text-lg text-fg-muted italic">{t("artist.empty")}</p>}
      <Discography id="albums" title={t("artist.albums")} releases={albums} />
      <Discography id="eps" title={t("artist.eps")} releases={eps} />
      <Discography id="singles" title={t("artist.singles")} releases={singles} />
      <Discography id="other" title={t("artist.other")} releases={other} />
    </article>
  );
}
