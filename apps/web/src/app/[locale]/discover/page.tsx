import {
  audienceLangSchema,
  DISCOVERY_YEAR_MIN,
  releaseTypeSchema,
  slugSchema,
  type AudienceLang,
} from "@spleen/validators";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ReleaseGrid, TopRatedList, TrendsGrid } from "@/components/discovery/Charts";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField, TextField } from "@/components/ui/Field";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { seoMetadata } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { firstParam, hrefWith, pageParam, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "discover" });
  const [title, description] = [t("title"), t("intro")];
  return {
    title,
    description,
    ...(await seoMetadata(locale, "/discover", { title, description })),
  };
}

const PATH = "/discover";
const DECADES = Array.from({ length: 8 }, (_, i) => 2020 - i * 10);
const POPULAR_ON_PAGE = 4;
const linkClasses = "text-link underline-offset-2 hover:underline";
/** Empty block: a short muted sentence (no serif or italic in Lilas). */
const emptyText = "text-lg text-fg-muted text-pretty";

/** `?year=1977` within the accepted range, or undefined. */
function yearParam(value: string | string[] | undefined, step = 1): number | undefined {
  const year = Number(firstParam(value));
  if (!Number.isInteger(year) || year < DISCOVERY_YEAR_MIN || year > 2100) return undefined;
  return year % step === 0 ? year : undefined;
}

/**
 * Discovery: the week's trends by audience, recent releases, top rated charts (filters in
 * the URL, plain GET form) and popular reviews. Every block reads real data only.
 */
export default async function DiscoverPage({ params, searchParams }: Props) {
  const locale = initRouteLocale((await params).locale);
  const raw = await searchParams;
  const parsedLang = audienceLangSchema.safeParse(firstParam(raw.lang));
  const lang: AudienceLang = parsedLang.success ? parsedLang.data : locale === "en" ? "en" : "fr";
  const recentType = releaseTypeSchema.safeParse(firstParam(raw.recent));
  const topType = releaseTypeSchema.safeParse(firstParam(raw.type));
  const genre = slugSchema.safeParse(firstParam(raw.genre));
  const year = yearParam(raw.year);
  // A year wins over a decade (both cannot be asked together).
  const decade = year === undefined ? yearParam(raw.decade, 10) : undefined;
  const topInput = {
    genre: genre.success ? genre.data : undefined,
    year,
    decade,
    type: topType.success ? topType.data : "album",
    page: pageParam(raw.page),
  } as const;

  const api = await getApi();
  const [trends, recent, top, genres, popular, t, uiLocale] = await Promise.all([
    api.discovery.trends({ lang }),
    api.discovery.recent({
      type: recentType.success && recentType.data === "single" ? "single" : undefined,
      page: pageParam(raw.rpage),
    }),
    api.discovery.topRated(topInput),
    api.discovery.genres(),
    api.feed.popular({ lang, size: POPULAR_ON_PAGE }),
    getTranslations(),
    getLocale(),
  ]);
  const other: AudienceLang = lang === "fr" ? "en" : "fr";
  const keep = {
    lang: lang === uiLocale ? null : lang,
    recent: firstParam(raw.recent) ?? null,
    genre: topInput.genre ?? null,
    year: year ?? null,
    decade: decade ?? null,
    type: topInput.type === "album" ? null : topInput.type,
  };

  return (
    <div className="space-y-16">
      <Card tone="accent" className="md:p-10">
        <header className="max-w-3xl">
          <p className="font-mono text-xs tracking-[0.14em] uppercase">{t("discover.kicker")}</p>
          <h1 className="mt-5 font-display text-[44px] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance md:text-[clamp(56px,6vw,80px)]">
            {t("discover.title")}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty">{t("discover.intro")}</p>
        </header>
      </Card>

      <section aria-labelledby="trends" className="scroll-mt-24">
        <SectionHeading id="trends">
          {lang === "fr" ? t("discover.trendsTitleFr") : t("discover.trendsTitleEn")}
        </SectionHeading>
        <p className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-fg-muted">
          <span>{t("discover.trendsHint")}</span>
          <Link
            href={hrefWith(PATH, { ...keep, lang: other === uiLocale ? null : other })}
            scroll={false}
            className={linkClasses}
          >
            {other === "fr" ? t("discover.trendsSwitchFr") : t("discover.trendsSwitchEn")}
          </Link>
        </p>
        {trends.length === 0 ? (
          <p className={emptyText}>{t("discover.trendsEmpty")}</p>
        ) : (
          <TrendsGrid items={trends} />
        )}
      </section>

      <section aria-labelledby="recent" className="scroll-mt-24">
        <SectionHeading id="recent">{t("discover.recentTitle")}</SectionHeading>
        <LinkTabs
          label={t("discover.recentTitle")}
          current={recentType.success && recentType.data === "single" ? "single" : "albums"}
          tabs={[
            {
              id: "albums",
              label: t("discover.recentAlbums"),
              href: hrefWith(PATH, { ...keep, recent: null }),
            },
            {
              id: "single",
              label: t("discover.recentSingles"),
              href: hrefWith(PATH, { ...keep, recent: "single" }),
            },
          ]}
        />
        <div className="pt-6">
          {recent.total === 0 ? (
            <p className={emptyText}>{t("discover.recentEmpty")}</p>
          ) : (
            <ReleaseGrid releases={recent.items} />
          )}
          <Pagination
            page={recent.page}
            pageCount={recent.pageCount}
            hrefFor={(n) => `${hrefWith(PATH, { ...keep, rpage: n })}#recent`}
            className="mt-8"
          />
        </div>
      </section>

      <section aria-labelledby="top" className="scroll-mt-24">
        <SectionHeading id="top">{t("discover.topTitle")}</SectionHeading>
        <p className="mb-5 max-w-2xl text-sm text-fg-muted text-pretty">
          {t("discover.topHint", { count: top.minRatings })}
        </p>
        <form
          action={`/${locale}${PATH}#top`}
          aria-label={t("discover.filtersLabel")}
          className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_1fr_auto] lg:items-end"
        >
          {keep.lang && <input type="hidden" name="lang" value={keep.lang} />}
          {keep.recent && <input type="hidden" name="recent" value={keep.recent} />}
          <SelectField label={t("discover.genre")} name="genre" defaultValue={topInput.genre ?? ""}>
            <option value="">{t("discover.allGenres")}</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("discover.period")}
            name="decade"
            defaultValue={decade?.toString() ?? ""}
          >
            <option value="">{t("discover.allTime")}</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {t("discover.decade", { decade: String(d) })}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t("discover.year")}
            type="number"
            name="year"
            inputMode="numeric"
            min={DISCOVERY_YEAR_MIN}
            max={2100}
            defaultValue={year ?? ""}
          />
          <SelectField label={t("discover.type")} name="type" defaultValue={topInput.type}>
            {(["album", "ep", "single"] as const).map((type) => (
              <option key={type} value={type}>
                {t(`releaseType.${type}`)}
              </option>
            ))}
          </SelectField>
          <div className="flex min-h-11 items-center gap-3">
            <Button type="submit">{t("discover.apply")}</Button>
            <Link
              href={`${hrefWith(PATH, { lang: keep.lang, recent: keep.recent })}#top`}
              scroll={false}
              className={`text-sm ${linkClasses}`}
            >
              {t("discover.reset")}
            </Link>
          </div>
        </form>
        {top.total === 0 ? (
          <p className={emptyText}>{t("discover.topEmpty")}</p>
        ) : (
          <TopRatedList items={top.items} />
        )}
        <Pagination
          page={top.page}
          pageCount={top.pageCount}
          hrefFor={(n) => `${hrefWith(PATH, { ...keep, page: n })}#top`}
          className="mt-8"
        />
      </section>

      <section aria-labelledby="reviews" className="scroll-mt-24">
        <SectionHeading
          id="reviews"
          action={
            <Link
              href={hrefWith("/", { tab: "popular", lang: keep.lang })}
              className={`text-sm ${linkClasses}`}
            >
              {t("discover.seeAll")}
            </Link>
          }
        >
          {t("discover.reviewsTitle")}
        </SectionHeading>
        {popular.items.length === 0 ? (
          <p className={emptyText}>{t("feed.popularEmpty")}</p>
        ) : (
          <ul className="grid items-start gap-4 md:grid-cols-2">
            {popular.items.map((review) => (
              <li key={review.id} className="empty:hidden">
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
