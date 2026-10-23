import type { Track } from "@spleen/api";
import { ratingToStars, slugSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { ArtistLinks } from "@/components/catalog/ArtistLinks";
import { CatalogNotice } from "@/components/catalog/CatalogNotice";
import { ListenOn } from "@/components/catalog/ListenOn";
import { SecondaryTypes } from "@/components/catalog/SecondaryTypes";
import { ListenControls } from "@/components/release/ListenControls";
import { ListCard } from "@/components/social/ListCard";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { FlagIcon } from "@/components/ui/icons";
import { RatingHistogram } from "@/components/ui/RatingHistogram";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";
import { initRouteLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { formatDuration, formatReleaseDate } from "@/lib/release-date";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const getRelease = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return (await getApi()).release.bySlug({ slug: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const release = await getRelease(slug);
  if (!release) return {};
  return { title: `${release.title} – ${release.artists.map((a) => a.name).join(", ")}` };
}

/** Tracks grouped by disc (a single group for one-disc releases). */
function byDisc(tracks: Track[]): [number, Track[]][] {
  const discs = new Map<number, Track[]>();
  for (const track of tracks) discs.set(track.disc, [...(discs.get(track.disc) ?? []), track]);
  return [...discs.entries()];
}

export default async function AlbumPage({ params }: Props) {
  const { locale, slug } = await params;
  initRouteLocale(locale);
  const release = await getRelease(slug);
  if (!release) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const average = release.averageRating;
  const api = await getApi();
  const target = { kind: "release" as const, id: release.id };
  const [mine, moods] = await Promise.all([
    api.listening.myState(target),
    api.listening.moods.list(),
  ]);
  const signedIn = mine !== null;
  const discs = byDisc(release.tracks);
  // A track appearing on several discs is rated once.
  const logTracks = [
    ...new Map(
      release.tracks.flatMap((track) =>
        track.id
          ? [[track.id, { id: track.id, title: track.title, position: track.position }]]
          : [],
      ),
    ).values(),
  ];

  const facts = [
    release.releaseDate
      ? release.releaseDatePrecision === "day"
        ? t("album.releasedOn", {
            date: formatReleaseDate(format, release.releaseDate, "day"),
          })
        : t("album.releasedIn", {
            date: formatReleaseDate(format, release.releaseDate, release.releaseDatePrecision),
          })
      : t("album.dateUnknown"),
    release.tracks.length > 0 && t("album.trackCount", { count: release.tracks.length }),
    release.totalDurationMs > 0 &&
      t("album.duration", { minutes: Math.round(release.totalDurationMs / 60000) }),
  ].filter(Boolean);

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
            <SecondaryTypes types={release.secondaryTypes} />
            {release.year !== null && <Badge>{String(release.year)}</Badge>}
          </div>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            {release.title}
          </h1>
          <p className="mt-2 text-lg">
            <span className="text-fg-muted">{t("album.by")} </span>
            <ArtistLinks artists={release.artists} />
          </p>
          <p className="mt-1 text-sm text-fg-muted">{facts.join(" · ")}</p>

          {release.genres.length > 0 && (
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
          )}

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
            {release.ratingsHidden && (
              <p className="mt-3 text-sm text-fg-muted italic">{t("listening.blindHidden")}</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <ListenControls
            target={target}
            title={release.title}
            initial={mine}
            moods={moods}
            tracks={logTracks}
          />
          <ListenOn links={release.listenLinks} />
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
          {release.isStub ? (
            <div className="space-y-2">
              <p className="font-serif text-lg text-fg-muted italic">{t("album.stubTitle")}</p>
              <CatalogNotice
                signedIn={signedIn}
                memberText={t("album.stubMember")}
                visitorText={t("album.stubVisitor")}
              />
            </div>
          ) : release.tracks.length === 0 ? (
            <p className="font-serif text-lg text-fg-muted italic">{t("album.noTracks")}</p>
          ) : (
            discs.map(([disc, tracks]) => (
              <div key={disc} className="mb-6 last:mb-0">
                {discs.length > 1 && (
                  <h3 className="mb-1 font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
                    {t("album.disc", { number: disc })}
                  </h3>
                )}
                <ol className="divide-y divide-border/50">
                  {tracks.map((track) => (
                    <li key={track.position} className="flex items-baseline gap-4 py-2.5">
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-fg-muted">
                        {track.position}
                      </span>
                      <span className="flex-1">
                        {track.slug ? (
                          <Link href={`/track/${track.slug}`} className="hover:text-star">
                            {track.title}
                          </Link>
                        ) : (
                          track.title
                        )}
                      </span>
                      <span className="font-mono text-xs text-fg-muted tabular">
                        {track.durationMs === null ? "–" : formatDuration(track.durationMs)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
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
