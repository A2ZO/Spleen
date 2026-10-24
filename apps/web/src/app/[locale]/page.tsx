import { audienceLangSchema, cursorSchema, type AudienceLang } from "@spleen/validators";
import { getLocale, getTranslations } from "next-intl/server";

import { Turntable } from "@/components/release/Turntable";
import { FeedItemCard } from "@/components/social/FeedItemCard";
import { MemberRow } from "@/components/social/MemberRow";
import { ReviewCard } from "@/components/social/ReviewCard";
import { ButtonLink } from "@/components/ui/Button";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const TABS = ["friends", "popular"] as const;
type Tab = (typeof TABS)[number];

const linkClasses = "text-link underline-offset-2 hover:underline";

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

async function FriendsFeed({ cursor }: { cursor: string | null }) {
  const t = await getTranslations("feed");
  const api = await getApi();
  const feed = await api.feed.friends({ cursor: cursor ?? undefined });
  const now = new Date();
  if (feed.items.length === 0 && !cursor) {
    const suggestions = await api.feed.suggestions();
    return (
      <div className="space-y-6">
        <div>
          <p className="font-serif text-2xl text-balance">{t("emptyTitle")}</p>
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
      <ul className="space-y-4">
        {feed.items.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
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
  cursor,
  tabParam,
}: {
  lang: AudienceLang;
  cursor: string | null;
  tabParam: string | null;
}) {
  const t = await getTranslations("feed");
  const locale = await getLocale();
  const popular = await (await getApi()).feed.popular({ lang, cursor: cursor ?? undefined });
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
        <p className="py-6 font-serif text-lg text-fg-muted italic">{t("popularEmpty")}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {popular.items.map((review) => (
            <li key={review.id}>
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

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  initRouteLocale(locale);
  const t = await getTranslations();
  const api = await getApi();
  const me = await api.account.me();
  const member = me?.profile ?? null;
  const raw = await searchParams;
  const parsedCursor = cursorSchema.safeParse(firstParam(raw.after));
  const cursor = parsedCursor.success ? parsedCursor.data : null;
  const parsedLang = audienceLangSchema.safeParse(firstParam(raw.lang));
  const lang: AudienceLang = parsedLang.success ? parsedLang.data : locale === "en" ? "en" : "fr";
  // Members land on their friends; visitors only have the popular reviews.
  const tab: Tab = member ? (TABS.find((x) => x === firstParam(raw.tab)) ?? "friends") : "popular";
  const shelfHref = member ? `/u/${member.username}` : me ? "/welcome" : "/sign-in";

  if (!member) {
    return (
      <div className="space-y-20">
        <section className="grid items-center gap-10 pt-4 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-star uppercase">
              {t("home.kicker")}
            </p>
            <h1 className="mt-4 text-5xl leading-[1.02] font-semibold text-balance sm:text-7xl">
              {t("home.title")}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-fg-muted text-pretty">{t("home.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={shelfHref}>
                {me ? t("home.ctaWelcome") : t("home.ctaJoin")}
              </ButtonLink>
              <ButtonLink href="/search" variant="outline">
                {t("home.ctaSearch")}
              </ButtonLink>
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto hidden w-full max-w-sm md:block">
            <div className="absolute inset-6 rounded-full bg-star/10 blur-3xl" />
            <Turntable playing className="relative h-auto w-full drop-shadow-2xl" />
          </div>
        </section>
        <section aria-labelledby="popular">
          <SectionHeading id="popular">{t("feed.popularTitle")}</SectionHeading>
          <PopularFeed lang={lang} cursor={cursor} tabParam={null} />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-xs tracking-[0.25em] text-star uppercase">
          {t("home.kicker")}
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-balance sm:text-5xl">{t("home.title")}</h1>
      </header>
      <section aria-labelledby="feed">
        <h2 id="feed" className="sr-only">
          {t("feed.title")}
        </h2>
        <LinkTabs
          label={t("feed.tabsLabel")}
          current={tab}
          tabs={[
            { id: "friends", label: t("feed.friends"), href: "/" },
            { id: "popular", label: t("feed.popular"), href: hrefWith("/", { tab: "popular" }) },
          ]}
        />
        <div className="pt-6">
          {tab === "friends" ? (
            <FriendsFeed cursor={cursor} />
          ) : (
            <PopularFeed lang={lang} cursor={cursor} tabParam="popular" />
          )}
        </div>
      </section>
    </div>
  );
}
