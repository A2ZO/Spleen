import { slugSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { ArtistLinks } from "@/components/catalog/ArtistLinks";
import { CatalogReportButton } from "@/components/catalog/CatalogReportButton";
import { ListenOn } from "@/components/catalog/ListenOn";
import { CommunityRating } from "@/components/detail/CommunityRating";
import { DetailBar } from "@/components/detail/DetailBar";
import { moreMenuItem } from "@/components/detail/MoreMenu";
import { AddToListButton } from "@/components/lists/AddToList";
import { ListenControls } from "@/components/release/ListenControls";
import { MyListensCard } from "@/components/release/MyListensCard";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { Badge } from "@/components/ui/Badge";
import { CoverThumb } from "@/components/detail/CoverThumb";
import { Cover } from "@/components/ui/Cover";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { phoneTitleSize } from "@/lib/display-title";
import { seoMetadata } from "@/lib/seo";
import { missingCatalogPage } from "@/lib/catalog-redirect";
import { formatDuration } from "@/lib/release-date";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const getTrack = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return (await getApi()).track.bySlug({ slug: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = metadataLocale(rawLocale);
  const track = await getTrack(slug);
  if (!track) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const artists = track.artists.map((a) => a.name).join(", ");
  const title = `${track.title} – ${artists}`;
  const description = t("track", { title: track.title, artists });
  return {
    title,
    description,
    ...(await seoMetadata(locale, `/track/${slug}`, { title, description })),
  };
}

export default async function TrackPage({ params }: Props) {
  const { locale, slug } = await params;
  initRouteLocale(locale);
  const track = await getTrack(slug);
  if (!track) return missingCatalogPage("track", slug, locale);

  const t = await getTranslations();
  const album = track.release;
  const api = await getApi();
  const target = { kind: "track" as const, id: track.id };
  const [mine, moods, me] = await Promise.all([
    api.listening.myState(target),
    api.listening.moods.list(),
    api.account.me(),
  ]);
  const kicker = t("track.kicker");
  const year = album?.year ?? null;
  const report = mine ? <CatalogReportButton target={target} className={moreMenuItem} /> : null;
  const duration = track.durationMs === null ? null : formatDuration(track.durationMs);

  return (
    <article className="cover-scope">
      <DetailBar
        backHref={album ? `/album/${album.slug}` : "/"}
        label={year === null ? kicker : `${kicker} · ${year}`}
        actions={report}
        thumb={
          album && <CoverThumb slug={album.slug} title={album.title} coverUrl={album.coverUrl} />
        }
      />

      <header className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,300px)_1fr] md:items-end md:gap-12">
        {album && (
          <div className="cover-scroll">
            <Cover
              slug={album.slug}
              title={album.title}
              artistName={album.artists[0]?.name}
              coverUrl={album.coverUrl}
              alt={t("album.coverAlt", { title: album.title })}
              sizes="(min-width: 768px) 300px, 220px"
              className="mx-auto w-full max-w-[220px] rounded-card-sm! md:max-w-none md:rounded-card!"
            />
          </div>
        )}
        <div className={cn("min-w-0 max-md:text-center", !album && "md:col-span-2")}>
          <div className="flex flex-wrap gap-2 max-md:hidden">
            <Badge>{kicker}</Badge>
            {duration && <Badge>{duration}</Badge>}
          </div>
          <h1
            className={cn(
              "font-display leading-[0.9] font-extrabold tracking-[-0.04em] text-balance [overflow-wrap:anywhere] md:mt-5 md:text-[clamp(48px,6vw,88px)]",
              phoneTitleSize(track.title, "48"),
            )}
          >
            {track.title}
          </h1>
          <p className="mt-3 text-lg md:mt-4 md:text-[22px]">
            <span className="text-fg-muted">{t("album.by")} </span>
            <ArtistLinks
              artists={track.artists}
              linkClassName="font-medium underline decoration-1 underline-offset-4 hover:text-link"
            />
          </p>
          {album && (
            <p className="mt-1 text-base md:text-lg">
              <span className="text-fg-muted">{t("detail.on")} </span>
              <Link
                href={`/album/${album.slug}`}
                className="underline decoration-1 underline-offset-4 hover:text-link"
              >
                {album.title}
              </Link>
            </p>
          )}
          {duration && (
            <p className="mt-2 text-sm text-fg-muted md:hidden">
              {t("track.duration", { duration })}
            </p>
          )}
        </div>
      </header>

      <div className="mt-8 space-y-5 md:mt-12">
        <ListenControls
          target={target}
          title={track.title}
          initial={mine}
          moods={moods}
          tracks={[]}
          actions={
            mine && (
              <AddToListButton
                target={target}
                title={track.title}
                className="max-md:w-full md:min-h-13"
              />
            )
          }
        />
        {track.listenLinks.length > 0 && <ListenOn links={track.listenLinks} />}
        {report && <div className="max-md:hidden">{report}</div>}
      </div>

      <div className={cn("mt-8 grid grid-cols-2 gap-3 md:mt-12 md:gap-5", !mine && "*:col-span-2")}>
        <CommunityRating
          average={track.averageRating}
          count={track.ratingCount}
          hidden={track.ratingsHidden ?? false}
        />
        {mine && (
          <MyListensCard
            target={target}
            title={track.title}
            initial={mine}
            moods={moods}
            tracks={[]}
            username={me?.profile?.username ?? null}
          />
        )}
      </div>

      <section aria-labelledby="appears-on" className="mt-14 md:mt-20">
        <SectionHeading id="appears-on">{t("track.appearsOn")}</SectionHeading>
        {track.appearsOn.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {track.appearsOn.map((release) => (
              <li key={release.id}>
                <ReleaseTile release={release} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted">{t("track.notOnRelease")}</p>
        )}
      </section>
    </article>
  );
}
