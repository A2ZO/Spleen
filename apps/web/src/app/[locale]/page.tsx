import type { ReleaseCard } from "@spleen/api";
import { getTranslations } from "next-intl/server";

import { ReleaseTile } from "@/components/release/ReleaseTile";
import { Turntable } from "@/components/release/Turntable";
import { ReviewCard } from "@/components/social/ReviewCard";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";
import { DEMO_USERNAME } from "@/lib/demo";
import { initRouteLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

function ReleaseGrid({ releases, ranked }: { releases: ReleaseCard[]; ranked?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
      {releases.map((release, index) => (
        <li key={release.id}>
          <ReleaseTile release={release} rank={ranked ? index + 1 : undefined} />
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  initRouteLocale(locale);
  const t = await getTranslations("home");
  const feed = await getApi().discover.home();
  const featured = feed.trending.fr[1] ?? feed.recent[0];

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-star uppercase">{t("kicker")}</p>
          <h1 className="mt-4 text-5xl leading-[1.02] font-semibold text-balance sm:text-7xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-fg-muted text-pretty">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`/u/${DEMO_USERNAME}`}>{t("ctaShelf")}</ButtonLink>
            {featured && (
              <ButtonLink href={`/album/${featured.slug}`} variant="outline">
                {t("ctaAlbum")}
              </ButtonLink>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-sm md:block">
          <div className="absolute inset-6 rounded-full bg-star/10 blur-3xl" />
          <Turntable playing className="relative h-auto w-full drop-shadow-2xl" />
        </div>
      </section>

      <section aria-labelledby="trending">
        <SectionHeading id="trending">{t("trendingTitle")}</SectionHeading>
        <Tabs
          label={t("trendingTabs")}
          items={[
            {
              id: "fr",
              label: t("trendingFr"),
              content: <ReleaseGrid releases={feed.trending.fr} ranked />,
            },
            {
              id: "en",
              label: t("trendingEn"),
              content: <ReleaseGrid releases={feed.trending.en} ranked />,
            },
          ]}
        />
      </section>

      <section aria-labelledby="recent">
        <SectionHeading id="recent">{t("recentTitle")}</SectionHeading>
        <ReleaseGrid releases={feed.recent} />
      </section>

      <section aria-labelledby="reviews">
        <SectionHeading id="reviews">{t("reviewsTitle")}</SectionHeading>
        <ul className="grid gap-4 lg:grid-cols-2">
          {feed.popularReviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
