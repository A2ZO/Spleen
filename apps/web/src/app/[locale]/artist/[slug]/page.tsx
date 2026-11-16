import type { ReleaseCard } from "@spleen/api";
import { discographyGroupSchema, slugSchema, type DiscographyGroup } from "@spleen/validators";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import { CatalogNotice } from "@/components/catalog/CatalogNotice";
import { CatalogReportButton } from "@/components/catalog/CatalogReportButton";
import { ListenOn } from "@/components/catalog/ListenOn";
import { DetailBar } from "@/components/detail/DetailBar";
import { moreMenuItem } from "@/components/detail/MoreMenu";
import { AddToListButton } from "@/components/lists/AddToList";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Link } from "@/i18n/navigation";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { missingCatalogPage } from "@/lib/catalog-redirect";
import { artistKind } from "@/lib/catalog-labels";
import { cn } from "@/lib/cn";
import { phoneTitleSize } from "@/lib/display-title";
import { seoMetadata } from "@/lib/seo";
import { getApi } from "@/server/api";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ all?: string | string[] }>;
};

/** `all`: the discography group listed in full (`?all=albums`), the others show 12. */
const getArtist = cache(async (slug: string, all?: DiscographyGroup) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return (await getApi()).artist.bySlug({ slug: parsed.data, all });
});

const fullGroup = async (searchParams: Props["searchParams"]) =>
  discographyGroupSchema.safeParse((await searchParams).all).data;

const linkClasses = "text-sm text-link underline-offset-2 hover:underline";

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = metadataLocale(rawLocale);
  // Same arguments as the page: one read for both (React `cache`).
  const artist = await getArtist(slug, await fullGroup(searchParams));
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

/** "See all" and "see less" are plain links (`?all=<group>`): they work without JavaScript. */
function Discography({
  group,
  title,
  releases,
  total,
  slug,
  expanded,
  seeAll,
  seeLess,
}: {
  group: DiscographyGroup;
  title: string;
  releases: ReleaseCard[];
  total: number;
  slug: string;
  expanded: boolean;
  seeAll: string;
  seeLess: string;
}) {
  if (releases.length === 0) return null;
  const action =
    total > releases.length ? (
      <Link href={`/artist/${slug}?all=${group}#${group}`} className={linkClasses}>
        {seeAll}
      </Link>
    ) : expanded ? (
      <Link href={`/artist/${slug}#${group}`} className={linkClasses}>
        {seeLess}
      </Link>
    ) : null;
  return (
    <section aria-labelledby={group}>
      <SectionHeading id={group} action={action}>
        {title}
      </SectionHeading>
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

export default async function ArtistPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  initRouteLocale(locale);
  const all = await fullGroup(searchParams);
  const [artist, me, t, uiLocale] = await Promise.all([
    getArtist(slug, all),
    getApi().then((api) => api.account.me()),
    getTranslations(),
    getLocale(),
  ]);
  if (!artist) return missingCatalogPage("artist", slug, locale);

  const { albums, eps, singles, other } = artist.discography;
  const totals = artist.discographyTotals;
  const empty = albums.length + eps.length + singles.length + other.length === 0;
  const group = (key: DiscographyGroup, releases: ReleaseCard[]) => (
    <Discography
      group={key}
      title={t(`artist.${key}`)}
      releases={releases}
      total={totals[key]}
      slug={artist.slug}
      expanded={key === all}
      seeAll={t("artist.seeAll", { count: totals[key] })}
      seeLess={t("artist.seeLess")}
    />
  );
  const signedIn = !!me;
  const target = { kind: "artist" as const, id: artist.id };
  const country = artist.country
    ? new Intl.DisplayNames([uiLocale], { type: "region" }).of(artist.country)
    : null;
  const kindLabel = t(`artist.kind.${artistKind(artist.type)}`);
  const report = me?.profile ? (
    <CatalogReportButton target={target} className={moreMenuItem} />
  ) : null;
  const smallCounts = [
    totals.eps > 0 && t("detail.epCount", { count: totals.eps }),
    totals.singles > 0 && t("detail.singleCount", { count: totals.singles }),
    totals.other > 0 && t("detail.otherCount", { count: totals.other }),
  ].filter(Boolean);
  const hasListenCard = artist.listenLinks.length > 0 || !!me?.profile;

  return (
    <article>
      <DetailBar
        backHref="/"
        label={country ? `${kindLabel} · ${country}` : kindLabel}
        actions={report}
      />

      <header className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_1fr] md:gap-12">
        <Avatar
          name={artist.name}
          seed={artist.slug}
          src={artist.imageUrl}
          className="mx-auto mb-0! size-[200px]! text-[72px] md:size-[300px]! md:text-[112px]"
        />
        <div className="min-w-0 max-md:text-center">
          <div className="flex flex-wrap gap-2 max-md:hidden">
            <Badge>{kindLabel}</Badge>
            {country && <Badge>{country}</Badge>}
          </div>
          <h1
            className={cn(
              "font-display leading-[0.9] font-extrabold tracking-[-0.04em] text-balance [overflow-wrap:anywhere] md:mt-5 md:text-[clamp(56px,7vw,104px)]",
              phoneTitleSize(artist.name, "56"),
            )}
          >
            {artist.name}
          </h1>
          {artist.disambiguation && (
            <p className="mt-3 text-lg text-fg-muted md:mt-4">{artist.disambiguation}</p>
          )}
        </div>
      </header>

      <div
        className={cn(
          "mt-8 grid gap-3 md:mt-12 md:gap-5",
          hasListenCard && "md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]",
        )}
      >
        <Card
          tone="accent"
          role="region"
          aria-labelledby="discography-title"
          className="flex flex-col gap-3"
        >
          <h2
            id="discography-title"
            className="font-mono text-[11px] font-normal tracking-[0.06em] uppercase md:text-xs"
          >
            {t("detail.discography")}
          </h2>
          <p className="font-display text-[56px] leading-[0.85] font-extrabold tracking-[-0.04em] md:text-[80px]">
            {t("detail.albumCount", { count: totals.albums })}
          </p>
          {smallCounts.length > 0 && <p className="text-[15px]">{smallCounts.join(" · ")}</p>}
        </Card>
        {hasListenCard && (
          <Card className="flex flex-col gap-4 md:self-start">
            {artist.listenLinks.length > 0 && <ListenOn links={artist.listenLinks} />}
            {me?.profile && (
              <div className="flex flex-wrap gap-2.5">
                <AddToListButton target={target} title={artist.name} />
                {report && <div className="max-md:hidden">{report}</div>}
              </div>
            )}
          </Card>
        )}
      </div>

      {artist.discographyPending && (
        <div className="mt-5 max-w-xl">
          <CatalogNotice
            signedIn={signedIn}
            memberText={t("artist.pendingMember")}
            visitorText={t("artist.pendingVisitor")}
          />
        </div>
      )}

      <div className="mt-14 space-y-14 md:mt-20 md:space-y-20">
        {empty && <p className="text-fg-muted">{t("artist.empty")}</p>}
        {group("albums", albums)}
        {group("eps", eps)}
        {group("singles", singles)}
        {group("other", other)}
      </div>
    </article>
  );
}
