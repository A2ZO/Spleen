import { ratingToStars, slugSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { ListenControls } from "@/components/release/ListenControls";
import { ListCard } from "@/components/social/ListCard";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { ExternalIcon, FlagIcon } from "@/components/ui/icons";
import { RatingHistogram } from "@/components/ui/RatingHistogram";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";
import { initRouteLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const getRelease = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return getApi().release.bySlug({ slug: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const release = await getRelease(slug);
  if (!release) return {};
  return { title: `${release.title} – ${release.artists.map((a) => a.name).join(", ")}` };
}

function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default async function AlbumPage({ params }: Props) {
  const { locale, slug } = await params;
  initRouteLocale(locale);
  const release = await getRelease(slug);
  if (!release) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const artistNames = release.artists.map((a) => a.name).join(", ");
  const average = release.averageRating;

  return (
    <article className="space-y-16">
      <header className="grid gap-8 md:grid-cols-[minmax(0,320px)_1fr_minmax(0,300px)] md:gap-10">
        <Cover
          slug={release.slug}
          title={release.title}
          artistName={release.artists[0]?.name}
          coverUrl={release.coverUrl}
          alt={t("album.coverAlt", { title: release.title })}
          sizes="(min-width: 768px) 320px, 100vw"
          className="mx-auto w-full max-w-xs md:max-w-none"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge>{t(`releaseType.${release.type}`)}</Badge>
            <Badge>{release.year}</Badge>
          </div>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            {release.title}
          </h1>
          <p className="mt-2 text-lg">
            <span className="text-fg-muted">{t("album.by")} </span>
            {artistNames}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            {t("album.releasedOn", {
              date: format.dateTime(new Date(release.releaseDate), { dateStyle: "long" }),
            })}
            {" · "}
            {t("album.trackCount", { count: release.tracks.length })}
            {" · "}
            {t("album.duration", { minutes: Math.round(release.totalDurationMs / 60000) })}
          </p>

          <div className="mt-6">
            <h2 className="sr-only">{t("album.genres")}</h2>
            <ul className="flex flex-wrap gap-2">
              {release.genres.map((genre) => (
                <li
                  key={genre}
                  className="rounded-full border border-border px-3 py-1 text-sm text-fg-muted"
                >
                  {genre}
                </li>
              ))}
            </ul>
          </div>

          <section aria-labelledby="ratings" className="mt-8 max-w-md">
            <h2 id="ratings" className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
              {t("album.ratingsTitle")}
            </h2>
            <div className="mt-3 flex items-end gap-6">
              <div className="shrink-0">
                <p className="font-mono text-5xl leading-none text-star tabular">
                  {average === null
                    ? "–"
                    : format.number(ratingToStars(average), {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                  <span className="sr-only">
                    {average !== null &&
                      ` ${t("rating.outOfFive", { stars: format.number(ratingToStars(average), { maximumFractionDigits: 1 }) })}`}
                  </span>
                </p>
                <Stars rating={average} className="mt-2 text-lg" />
                <p className="mt-1 text-xs text-fg-muted">
                  {t("rating.count", { count: release.ratingCount })}
                </p>
              </div>
              <RatingHistogram
                distribution={release.ratingDistribution}
                label={t("album.distributionLabel")}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <ListenControls />
          <section aria-labelledby="listen-on">
            <h2
              id="listen-on"
              className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase"
            >
              {t("album.listenOn")}
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {release.listenLinks.map((link) => (
                <li key={link.service}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm text-link hover:border-link"
                  >
                    {t(`services.${link.service}`)}
                    <ExternalIcon className="text-xs opacity-70" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-fg-muted hover:text-fg"
          >
            <FlagIcon /> {t("album.report")}
          </button>
        </aside>
      </header>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section aria-labelledby="tracklist">
          <SectionHeading id="tracklist">{t("album.tracklist")}</SectionHeading>
          <ol className="divide-y divide-border/50">
            {release.tracks.map((track) => (
              <li key={track.position} className="flex items-baseline gap-4 py-2.5">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-fg-muted">
                  {track.position}
                </span>
                <span className="flex-1">{track.title}</span>
                <span className="font-mono text-xs text-fg-muted tabular">
                  {formatDuration(track.durationMs)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="reviews">
          <SectionHeading id="reviews">{t("album.reviewsTitle")}</SectionHeading>
          {release.reviews.length > 0 ? (
            <ul className="space-y-4">
              {release.reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard review={review} showRelease={false} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-serif text-lg text-fg-muted italic">{t("album.reviewsEmpty")}</p>
          )}
        </section>
      </div>

      {release.lists.length > 0 && (
        <section aria-labelledby="lists">
          <SectionHeading id="lists">{t("album.listsTitle")}</SectionHeading>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {release.lists.map((list) => (
              <li key={list.id}>
                <ListCard list={list} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
