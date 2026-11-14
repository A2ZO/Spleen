import type { Track } from "@spleen/api";
import { slugSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { ArtistLinks } from "@/components/catalog/ArtistLinks";
import { CatalogReportButton } from "@/components/catalog/CatalogReportButton";
import { CatalogNotice } from "@/components/catalog/CatalogNotice";
import { ListenOn } from "@/components/catalog/ListenOn";
import { SecondaryTypes } from "@/components/catalog/SecondaryTypes";
import { CommunityRating } from "@/components/detail/CommunityRating";
import { DetailBar } from "@/components/detail/DetailBar";
import { InListsCard } from "@/components/detail/InListsCard";
import { moreMenuItem } from "@/components/detail/MoreMenu";
import { AddToListButton } from "@/components/lists/AddToList";
import { ListenControls } from "@/components/release/ListenControls";
import { MyListensCard } from "@/components/release/MyListensCard";
import { ShelfPicker } from "@/components/shelf/ShelfPicker";
import { ListCard } from "@/components/social/ListCard";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { seoMetadata } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { missingCatalogPage } from "@/lib/catalog-redirect";
import { cn } from "@/lib/cn";
import { phoneTitleSize } from "@/lib/display-title";
import { formatDuration, formatReleaseDate } from "@/lib/release-date";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; slug: string }> };

const getRelease = cache(async (slug: string) => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  return (await getApi()).release.bySlug({ slug: parsed.data });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = metadataLocale(rawLocale);
  const release = await getRelease(slug);
  if (!release) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const artists = release.artists.map((a) => a.name).join(", ");
  const title = `${release.title} – ${artists}`;
  const description = t("album", { title: release.title, artists });
  return {
    title,
    description,
    ...(await seoMetadata(locale, `/album/${slug}`, {
      subject: { kind: "release", key: slug },
      page: release.seo,
      title,
      description,
    })),
  };
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
  const api = await getApi();
  // What does not depend on the release starts with it (one wave less).
  const early = Promise.all([
    api.listening.moods.list(),
    api.account.me().then(async (me) => (me ? { me, shelf: await api.shelf.mine() } : null)),
  ]);
  early.catch(() => {}); // awaited below; not awaited when the release is missing
  const release = await getRelease(slug);
  if (!release) return missingCatalogPage("release", slug, locale);

  const target = { kind: "release" as const, id: release.id };
  const [t, format, mine, [moods, member]] = await Promise.all([
    getTranslations(),
    getFormatter(),
    api.listening.myState(target),
    early,
  ]);
  const shelf = member?.shelf ?? null;
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

  const releaseDate = release.releaseDate
    ? release.releaseDatePrecision === "day"
      ? t("album.releasedOn", { date: formatReleaseDate(format, release.releaseDate, "day") })
      : t("album.releasedIn", {
          date: formatReleaseDate(format, release.releaseDate, release.releaseDatePrecision),
        })
    : t("album.dateUnknown");
  const size = [
    release.tracks.length > 0 && t("album.trackCount", { count: release.tracks.length }),
    release.totalDurationMs > 0 &&
      t("album.duration", { minutes: Math.round(release.totalDurationMs / 60000) }),
  ].filter(Boolean);
  const typeLabel = t(`releaseType.${release.type}`);
  const report = signedIn ? <CatalogReportButton target={target} className={moreMenuItem} /> : null;

  // Mosaic: never an empty card. Phones keep two cards, the lists card standing in for
  // "Your listens" for visitors; a lone card takes the full row.
  const hasLists = release.lists.length > 0;
  const cards = 1 + (mine ? 1 : 0) + (hasLists ? 1 : 0);
  const phoneCards = 1 + (mine || hasLists ? 1 : 0);

  return (
    <article className="cover-scope">
      <DetailBar
        backHref={release.artists[0] ? `/artist/${release.artists[0].slug}` : "/"}
        label={release.year === null ? typeLabel : `${typeLabel} · ${release.year}`}
        actions={report}
        thumb={
          <Cover
            slug={release.slug}
            title={release.title}
            coverUrl={release.coverUrl}
            showText={false}
            sizes="32px"
          />
        }
      />

      <header className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,420px)_1fr] md:items-end md:gap-12">
        <div className="cover-scroll">
          <Cover
            slug={release.slug}
            title={release.title}
            artistName={release.artists[0]?.name}
            coverUrl={release.coverUrl}
            alt={t("album.coverAlt", { title: release.title })}
            sizes="(min-width: 768px) 420px, 300px"
            className="mx-auto w-full max-w-[300px] rounded-card-sm! md:max-w-none md:rounded-card!"
          />
        </div>

        <div className="min-w-0 max-md:text-center">
          <div className="flex flex-wrap gap-2 max-md:hidden">
            <Badge>{typeLabel}</Badge>
            <SecondaryTypes types={release.secondaryTypes} />
            {release.year !== null && <Badge>{String(release.year)}</Badge>}
            {size.length > 0 && <Badge>{size.join(" · ")}</Badge>}
          </div>
          <h1
            className={cn(
              "font-display leading-[0.9] font-extrabold tracking-[-0.04em] text-balance [overflow-wrap:anywhere] md:mt-5 md:text-[clamp(56px,7vw,104px)]",
              phoneTitleSize(release.title, "56"),
            )}
          >
            {release.title}
          </h1>
          <p className="mt-3 text-lg md:mt-4 md:text-[22px]">
            <span className="text-fg-muted">{t("album.by")} </span>
            <ArtistLinks
              artists={release.artists}
              linkClassName="font-medium underline decoration-1 underline-offset-4 hover:text-link"
            />
          </p>
          <p className="mt-2 text-sm text-fg-muted md:hidden">
            {[...size, ...release.genres.slice(0, 3)].join(" · ")}
          </p>
          {release.genres.length > 0 && (
            <div className="mt-6 max-md:hidden">
              <h2 className="sr-only">{t("album.genres")}</h2>
              <ul className="flex flex-wrap gap-2">
                {release.genres.map((genre) => (
                  <li
                    key={genre}
                    className="rounded-full border border-border px-3.5 py-1.5 text-sm text-fg-muted"
                  >
                    {genre}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-sm text-fg-muted md:mt-5">{releaseDate}</p>
        </div>
      </header>

      <div className="mt-8 space-y-5 md:mt-12">
        <ListenControls
          target={target}
          title={release.title}
          initial={mine}
          moods={moods}
          tracks={logTracks}
          actions={
            shelf && (
              <AddToListButton
                target={target}
                title={release.title}
                className="max-md:w-full md:min-h-13"
              />
            )
          }
          extra={
            shelf && (
              <ShelfPicker
                release={{ id: release.id, title: release.title }}
                shelf={shelf}
                variant="ghost"
                className="min-h-9 w-auto! px-3 text-sm"
              />
            )
          }
        />
        {release.listenLinks.length > 0 && <ListenOn links={release.listenLinks} />}
        {report && <div className="max-md:hidden">{report}</div>}
      </div>

      <div
        className={cn(
          "mt-8 grid grid-cols-2 gap-3 md:mt-12 md:gap-5",
          cards === 3 ? "md:grid-cols-3" : cards === 2 ? "md:grid-cols-2" : "md:grid-cols-1",
          phoneCards === 1 && "max-md:*:col-span-2",
        )}
      >
        <CommunityRating
          average={release.averageRating}
          count={release.ratingCount}
          hidden={release.ratingsHidden ?? false}
          distribution={release.ratingDistribution}
        />
        {mine && (
          <MyListensCard
            target={target}
            title={release.title}
            initial={mine}
            moods={moods}
            tracks={logTracks}
            username={member?.me.profile?.username ?? null}
          />
        )}
        {hasLists && (
          <InListsCard lists={release.lists} className={mine ? "max-md:hidden" : undefined} />
        )}
      </div>

      <section aria-labelledby="tracklist" className="mt-14 md:mt-20">
        <SectionHeading id="tracklist">{t("album.tracklist")}</SectionHeading>
        {release.isStub ? (
          <div className="space-y-3">
            <p className="text-fg-muted">{t("album.stubTitle")}</p>
            <CatalogNotice
              signedIn={signedIn}
              memberText={t("album.stubMember")}
              visitorText={t("album.stubVisitor")}
            />
          </div>
        ) : release.tracks.length === 0 ? (
          <p className="text-fg-muted">{t("album.noTracks")}</p>
        ) : (
          discs.map(([disc, tracks]) => (
            <div key={disc} className="mb-8 last:mb-0">
              {discs.length > 1 && (
                <h3 className="mb-2 font-mono text-xs font-normal tracking-[0.06em] text-fg-muted uppercase">
                  {t("album.disc", { number: disc })}
                </h3>
              )}
              <ol>
                {tracks.map((track) => (
                  <li
                    key={track.position}
                    className="flex items-baseline gap-4 rounded-[14px] px-3.5 py-[13px] odd:bg-surface-alt"
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-[13px] text-fg-muted tabular">
                      {track.position}
                    </span>
                    <span className="min-w-0 flex-1 text-base md:text-[17px]">
                      {track.slug ? (
                        <Link href={`/track/${track.slug}`} className="hover:text-link">
                          {track.title}
                        </Link>
                      ) : (
                        track.title
                      )}
                    </span>
                    <span className="font-mono text-[13px] text-fg-muted tabular">
                      {track.durationMs === null ? "–" : formatDuration(track.durationMs)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>

      <section aria-labelledby="reviews" className="mt-14 md:mt-20">
        <SectionHeading id="reviews">{t("album.reviewsTitle")}</SectionHeading>
        {release.reviews.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {release.reviews.map((review) => (
              <li key={review.id} className="empty:hidden">
                <ReviewCard review={review} showRelease={false} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted">{t("album.reviewsEmpty")}</p>
        )}
      </section>

      {hasLists && (
        <section aria-labelledby="lists" className="mt-14 md:mt-20">
          <SectionHeading id="lists">{t("album.listsTitle")}</SectionHeading>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {release.lists.map((list) => (
              <li key={list.id} className="empty:hidden">
                <ListCard list={list} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
