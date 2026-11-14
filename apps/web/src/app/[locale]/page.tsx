import { audienceLangSchema, cursorSchema, type AudienceLang } from "@spleen/validators";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import { TrendsGrid } from "@/components/discovery/Charts";
import { JustOutCard } from "@/components/home/JustOutCard";
import { MonthCard } from "@/components/home/MonthCard";
import { RateButton } from "@/components/home/RateButton";
import { FeedItemCard } from "@/components/social/FeedItemCard";
import { MemberRow } from "@/components/social/MemberRow";
import { ReviewCard } from "@/components/social/ReviewCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { loadCursorPage } from "@/lib/api-errors";
import { currentMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { phoneTitleSize } from "@/lib/display-title";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { seoMetadata } from "@/lib/seo";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "metadata" });
  // Feed tabs and pages (?tab=…, ?after=…) are views of the home page: indexed once.
  const tabbed = Object.keys(await searchParams).length > 0;
  return seoMetadata(locale, "/", {
    noindex: tabbed,
    title: `${t("title")} · ${t("tagline")}`,
    description: t("description"),
  });
}

const TABS = ["friends", "popular"] as const;
type Tab = (typeof TABS)[number];

const linkClasses = "text-link underline-offset-2 hover:underline";

/** Records in the home page's trends (one row on a wide screen). */
const HOME_CHART_SIZE = 6;

/**
 * The week's trends and the newest release, from real data only. A block with nothing to
 * show is left out rather than shown empty (trends already widen to every language and 30
 * days). Only the newest recent release is shown ("Just out"); the list lives on /discover.
 * Memoised per request: the page starts these reads while the session is being read.
 */
const discoveryReads = cache(async (lang: AudienceLang) => {
  const api = await getApi();
  return Promise.all([
    api.discovery.trends({ lang, size: HOME_CHART_SIZE }),
    api.discovery.recent({ size: 1 }),
  ]);
});

async function Trends({ lang }: { lang: AudienceLang }) {
  const t = await getTranslations("discover");
  const [trends] = await discoveryReads(lang);
  if (trends.length === 0) return null;
  return (
    <section aria-labelledby="trends" className="scroll-mt-24">
      <SectionHeading
        id="trends"
        action={
          <Link href="/discover" className={`shrink-0 text-sm ${linkClasses}`}>
            {t("more")}
          </Link>
        }
      >
        {lang === "fr" ? t("trendsTitleFr") : t("trendsTitleEn")}
      </SectionHeading>
      <TrendsGrid items={trends} />
    </section>
  );
}

async function JustOut({ lang }: { lang: AudienceLang }) {
  const [, recent] = await discoveryReads(lang);
  const release = recent.items[0];
  return release ? <JustOutCard release={release} /> : null;
}

/** The member's month, from the diary calendar's own procedure and month rule. */
async function Month({ username }: { username: string }) {
  const api = await getApi();
  const month = currentMonth();
  const entries = await api.profile.diaryMonth({ username, month });
  if (!entries) return null;
  return (
    <MonthCard
      month={month}
      entries={entries}
      diaryHref={hrefWith(`/u/${username}/diary`, { view: "calendar", month })}
    />
  );
}

/** Small mono label and huge title of the lilac block. */
const heroLabel = "font-mono text-xs tracking-[0.14em] uppercase";
const heroTitle =
  "mt-5 font-display leading-[0.95] font-extrabold tracking-[-0.04em] text-balance md:text-[clamp(56px,6vw,80px)]";

/** "Older" link (cursor) and, past the first page, back to the newest. */
async function FeedPaging({
  nextHref,
  firstHref,
  paged,
}: {
  nextHref: string | null;
  firstHref: string;
  paged: boolean;
}) {
  if (!nextHref && !paged) return null;
  const t = await getTranslations("feed");
  return (
    <nav aria-label={t("pagingLabel")} className="mt-8 flex justify-between gap-4 text-sm">
      {paged ? (
        <Link href={firstHref} scroll={false} className={linkClasses}>
          ↑ {t("newest")}
        </Link>
      ) : (
        <span />
      )}
      {nextHref && (
        <Link href={nextHref} scroll={false} rel="next" className={linkClasses}>
          {t("older")} ↓
        </Link>
      )}
    </nav>
  );
}

async function FriendsFeed({ cursor: requested }: { cursor: string | null }) {
  const t = await getTranslations("feed");
  const api = await getApi();
  const { page: feed, cursor = null } = await loadCursorPage(requested ?? undefined, (c) =>
    api.feed.friends({ cursor: c }),
  );
  const now = new Date();
  if (feed.items.length === 0 && !cursor) {
    const suggestions = await api.feed.suggestions();
    return (
      <div className="space-y-6">
        <div>
          <p className="font-display text-2xl font-bold text-balance">{t("emptyTitle")}</p>
          <p className="mt-2 max-w-xl text-fg-muted text-pretty">{t("emptyBody")}</p>
        </div>
        {suggestions.length > 0 && (
          <section aria-labelledby="suggestions">
            <h3
              id="suggestions"
              className="mb-3 font-mono text-xs tracking-[0.2em] text-star uppercase"
            >
              {t("suggestionsTitle")}
            </h3>
            <ul className="divide-y divide-border/50">
              {suggestions.map((member) => (
                <li key={member.username}>
                  <MemberRow member={member} signedIn />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }
  return (
    <>
      <ul className="grid items-start gap-4 md:grid-cols-2">
        {feed.items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="empty:hidden">
            <FeedItemCard item={item} now={now} />
          </li>
        ))}
      </ul>
      <FeedPaging
        paged={cursor !== null}
        firstHref="/"
        nextHref={feed.nextCursor ? hrefWith("/", { after: feed.nextCursor }) : null}
      />
    </>
  );
}

async function PopularFeed({
  lang,
  cursor: requested,
  tabParam,
}: {
  lang: AudienceLang;
  cursor: string | null;
  tabParam: string | null;
}) {
  const t = await getTranslations("feed");
  const locale = await getLocale();
  const api = await getApi();
  const { page: popular, cursor = null } = await loadCursorPage(requested ?? undefined, (c) =>
    api.feed.popular({ lang, cursor: c }),
  );
  const other: AudienceLang = lang === "fr" ? "en" : "fr";
  const langLabel = (l: AudienceLang) => (l === "fr" ? t("langFr") : t("langEn"));
  const href = (l: AudienceLang, after: string | null = null) =>
    hrefWith("/", { tab: tabParam, lang: l === locale ? null : l, after });
  return (
    <>
      <p className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-fg-muted">
        <span>{t("popularHint", { lang: langLabel(lang) })}</span>
        <Link href={href(other)} scroll={false} className={linkClasses}>
          {t("popularSwitch", { lang: langLabel(other) })}
        </Link>
      </p>
      {popular.items.length === 0 ? (
        <p className="py-6 text-lg text-fg-muted">{t("popularEmpty")}</p>
      ) : (
        <ul className="grid items-start gap-4 md:grid-cols-2">
          {popular.items.map((review) => (
            <li key={review.id} className="empty:hidden">
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}
      <FeedPaging
        paged={cursor !== null}
        firstHref={href(lang)}
        nextHref={popular.nextCursor ? href(lang, popular.nextCursor) : null}
      />
    </>
  );
}

const HOW_STEPS = ["howRate", "howDiary", "howShelf"] as const;

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  initRouteLocale(locale);
  const raw = await searchParams;
  const parsedCursor = cursorSchema.safeParse(firstParam(raw.after));
  const cursor = parsedCursor.success ? parsedCursor.data : null;
  const parsedLang = audienceLangSchema.safeParse(firstParam(raw.lang));
  const lang: AudienceLang = parsedLang.success ? parsedLang.data : locale === "en" ? "en" : "fr";
  // Shown to everyone: started before knowing who is looking.
  discoveryReads(lang).catch(() => {});
  const [t, format, me] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getApi().then((api) => api.account.me()),
  ]);
  const member = me?.profile ?? null;
  // Members land on their friends; visitors only have the popular reviews.
  const tab: Tab = member ? (TABS.find((x) => x === firstParam(raw.tab)) ?? "friends") : "popular";
  const shelfHref = member ? `/u/${member.username}` : me ? "/welcome" : "/sign-in";

  if (!member) {
    return (
      <div className="space-y-14 md:space-y-20">
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card tone="accent" className="flex flex-col justify-between md:p-10">
            <div>
              <p className={heroLabel}>{t("home.kicker")}</p>
              <h1 className={cn(heroTitle, "text-[44px]")}>{t("home.title")}</h1>
              <p className="mt-5 max-w-xl text-lg text-pretty">{t("home.subtitle")}</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={shelfHref} variant="ink">
                {me ? t("home.ctaWelcome") : t("home.ctaJoin")}
              </ButtonLink>
              <ButtonLink href="/discover" variant="on-accent">
                {t("home.findMusic")}
              </ButtonLink>
            </div>
          </Card>
          <div className="flex flex-col gap-5">
            <Card>
              <h2 className="font-mono text-xs tracking-[0.14em] text-fg-muted uppercase">
                {t("home.howTitle")}
              </h2>
              <ol className="mt-4 space-y-3">
                {HOW_STEPS.map((key, index) => (
                  <li key={key} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-raised font-display text-sm font-bold"
                    >
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-pretty">{t(`home.${key}`)}</span>
                  </li>
                ))}
              </ol>
            </Card>
            <JustOut lang={lang} />
          </div>
        </div>
        <Trends lang={lang} />
        <section aria-labelledby="popular">
          <SectionHeading id="popular">{t("feed.popularTitle")}</SectionHeading>
          <PopularFeed lang={lang} cursor={cursor} tabParam={null} />
        </section>
      </div>
    );
  }

  // The display name is required; the username stands in rather than an empty title.
  const name = member.displayName.trim() || member.username;
  const today = format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-14 md:space-y-20">
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card tone="accent" className="flex flex-col justify-between md:p-10">
          <div>
            <p className={heroLabel}>{today}</p>
            <h1 className={cn(heroTitle, "[overflow-wrap:anywhere]", phoneTitleSize(name, "48"))}>
              {t("home.memberTitle", { name })}
            </h1>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <RateButton label={t("nav.rate")} />
            <ButtonLink href="/discover" variant="on-accent">
              {t("home.findMusic")}
            </ButtonLink>
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Month username={member.username} />
          <JustOut lang={lang} />
        </div>
      </div>
      <Trends lang={lang} />
      <section aria-labelledby="feed">
        <SectionHeading
          id="feed"
          className="flex-wrap items-center"
          action={
            <LinkTabs
              label={t("feed.tabsLabel")}
              current={tab}
              tabs={[
                { id: "friends", label: t("feed.friends"), href: "/" },
                {
                  id: "popular",
                  label: t("feed.popular"),
                  href: hrefWith("/", { tab: "popular" }),
                },
              ]}
            />
          }
        >
          {tab === "friends" ? t("home.friendsTitle") : t("feed.popularTitle")}
        </SectionHeading>
        {tab === "friends" ? (
          <FriendsFeed cursor={cursor} />
        ) : (
          <PopularFeed lang={lang} cursor={cursor} tabParam="popular" />
        )}
      </section>
    </div>
  );
}
