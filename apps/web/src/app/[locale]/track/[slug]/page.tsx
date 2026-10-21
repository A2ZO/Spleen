import { ratingToStars, slugSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { ArtistLinks } from "@/components/catalog/ArtistLinks";
import { ListenOn } from "@/components/catalog/ListenOn";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { Cover } from "@/components/ui/Cover";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";
import { initRouteLocale } from "@/i18n/locale";
import { formatDuration } from "@/lib/release-date";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const getTrack = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return (await getApi()).track.bySlug({ slug: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const track = await getTrack(slug);
  if (!track) return {};
  return { title: `${track.title} – ${track.artists.map((a) => a.name).join(", ")}` };
}

export default async function TrackPage({ params }: Props) {
  const { locale, slug } = await params;
  initRouteLocale(locale);
  const track = await getTrack(slug);
  if (!track) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const cover = track.release;

  return (
    <article className="space-y-14">
      <header className="grid gap-8 md:grid-cols-[minmax(0,220px)_1fr_minmax(0,300px)] md:gap-10">
        {cover ? (
          <Cover
            slug={cover.slug}
            title={cover.title}
            artistName={cover.artists[0]?.name}
            coverUrl={cover.coverUrl}
            alt={t("album.coverAlt", { title: cover.title })}
            sizes="(min-width: 768px) 220px, 60vw"
            className="mx-auto w-full max-w-[220px]"
          />
        ) : (
          <div aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
            {t("track.kicker")}
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            {track.title}
          </h1>
          <p className="mt-2 text-lg">
            <span className="text-fg-muted">{t("album.by")} </span>
            <ArtistLinks artists={track.artists} />
          </p>
          {track.durationMs !== null && (
            <p className="mt-1 text-sm text-fg-muted">
              {t("track.duration", { duration: formatDuration(track.durationMs) })}
            </p>
          )}
          <section aria-labelledby="ratings" className="mt-8">
            <h2 id="ratings" className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
              {t("album.ratingsTitle")}
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <Stars rating={track.averageRating} className="text-lg" />
              <span className="font-mono text-sm text-fg-muted">
                {track.averageRating === null
                  ? t("rating.none")
                  : format.number(ratingToStars(track.averageRating), {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                {" · "}
                {t("rating.count", { count: track.ratingCount })}
              </span>
            </div>
          </section>
        </div>
        <aside>
          <ListenOn links={track.listenLinks} />
        </aside>
      </header>

      <section aria-labelledby="appears-on">
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
          <p className="font-serif text-lg text-fg-muted italic">{t("track.notOnRelease")}</p>
        )}
      </section>
    </article>
  );
}
