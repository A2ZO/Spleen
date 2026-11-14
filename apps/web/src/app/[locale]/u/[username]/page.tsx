import type { ProfileDetail } from "@spleen/api";
import { usernameSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";

import { DiaryList } from "@/components/profile/DiaryList";
import { StatsPanel } from "@/components/profile/StatsPanel";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { ShelfEditor } from "@/components/shelf/ShelfEditor";
import { ShelfGrid } from "@/components/shelf/ShelfGrid";
import { ShelfPicker } from "@/components/shelf/ShelfPicker";
import { FollowButton, FollowerCountLink } from "@/components/social/FollowButton";
import { ListCard } from "@/components/social/ListCard";
import { MemberMenu } from "@/components/social/MemberMenu";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { profileNameLayout } from "@/lib/display-title";
import { seoMetadata } from "@/lib/seo";
import { Link, redirect } from "@/i18n/navigation";
import { firstParam, hrefWith, pageParam, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<SearchParams>;
};

const getProfile = cache(async (username: string) => {
  const parsed = usernameSchema.safeParse(decodeURIComponent(username));
  if (!parsed.success) return null;
  return (await getApi()).profile.byUsername({ username: parsed.data });
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: rawLocale, username } = await params;
  const locale = metadataLocale(rawLocale);
  const profile = await getProfile(username);
  if (!profile) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  const title = `${profile.displayName} (@${profile.username})`;
  const description = profile.bio || t("profile", { name: profile.displayName });
  // Tabs (?tab=…) are views of the same profile: one canonical page, indexed once.
  const tabbed = Object.keys(await searchParams).length > 0;
  return {
    title,
    description,
    ...(await seoMetadata(locale, `/u/${profile.username}`, {
      subject: { kind: "profile", key: profile.username },
      page: profile.seo,
      noindex: tabbed,
      title,
      description,
    })),
  };
}

const TABS = ["diary", "likes", "to-listen", "reviews", "lists", "stats"] as const;
type Tab = (typeof TABS)[number];

/*
 * Paged tabs, memoised per request: the page starts the open tab's read with the profile's
 * (one chain of round trips instead of two) and `TabContent` gets the same promise. Private
 * parts come back empty from the API, so starting early never reveals anything.
 */
const tabReads = {
  diary: cache(async (username: string, page: number) =>
    (await getApi()).profile.diary({ username, page }),
  ),
  likes: cache(async (username: string, page: number) =>
    (await getApi()).profile.likes({ username, page }),
  ),
  "to-listen": cache(async (username: string, page: number) =>
    (await getApi()).profile.toListen({ username, page }),
  ),
  reviews: cache(async (username: string, page: number) =>
    (await getApi()).profile.reviews({ username, page }),
  ),
  lists: cache(async (username: string, page: number) =>
    (await getApi()).profile.lists({ username, page }),
  ),
};

/**
 * Stats (null when private), read with the profile for its three figures and reused by the
 * Stats tab: keyed by the username as written in the URL, like `tabReads`.
 */
const getStats = cache(async (username: string) => (await getApi()).profile.stats({ username }));

const gridClasses = "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5";

function EmptyState({ children }: { children: string }) {
  return <p className="py-6 text-lg text-fg-muted">{children}</p>;
}

/** Releases (albums, EPs, singles) among distinct items listened to; tracks alone excluded. */
function releaseCount(counts: { album: number; ep: number; single: number }) {
  return counts.album + counts.ep + counts.single;
}

function Figure({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <Card
      tone={accent ? "accent" : "default"}
      className="flex min-w-0 flex-col-reverse justify-between gap-2 p-4 md:p-6"
    >
      <dt className={cn("text-xs leading-snug md:text-sm", !accent && "text-fg-muted")}>{label}</dt>
      <dd className="font-display text-[40px] leading-[0.9] font-extrabold tracking-[-0.04em] whitespace-nowrap tabular md:text-7xl">
        <CountUp value={value} />
      </dd>
    </Card>
  );
}

/** Only the active tab is loaded; each one is a link (`?tab=…&page=…`). */
async function TabContent({
  profile,
  requestedUsername,
  tab,
  page,
}: {
  profile: ProfileDetail;
  /** The username as written in the URL: the key the page used to start the tab's read. */
  requestedUsername: string;
  tab: Tab;
  page: number;
}) {
  const t = await getTranslations();
  const username = profile.username;
  const path = `/u/${username}`;
  const requested = requestedUsername;
  // A page past the last one (shared link, fewer items since) goes to the last page.
  const locale = await getLocale();
  const inRange = (p: { page: number; pageCount: number } | null) => {
    if (p && p.page > p.pageCount) {
      redirect({ href: hrefWith(path, { tab, page: p.pageCount }), locale });
    }
  };
  const pagination = (p: { page: number; pageCount: number }) => (
    <Pagination
      page={p.page}
      pageCount={p.pageCount}
      hrefFor={(n) => hrefWith(path, { tab, page: n })}
      className="mt-8"
    />
  );
  const privateDiary = (
    <EmptyState>{t("profile.diaryPrivate", { name: profile.displayName })}</EmptyState>
  );

  switch (tab) {
    case "diary": {
      if (profile.diaryHidden) return privateDiary;
      const diary = await tabReads.diary(requested, page);
      inRange(diary);
      if (!diary || diary.total === 0) return <EmptyState>{t("profile.diaryEmpty")}</EmptyState>;
      return (
        <div className="space-y-6">
          <DiaryList entries={diary.items} />
          {pagination(diary)}
          <p className="flex flex-wrap gap-4 text-sm">
            <Link href={`${path}/diary`} className="text-link underline-offset-2 hover:underline">
              {t("profile.diaryAll")}
            </Link>
            <Link
              href={hrefWith(`${path}/diary`, { view: "calendar" })}
              className="text-link underline-offset-2 hover:underline"
            >
              {t("profile.diaryCalendar")}
            </Link>
          </p>
        </div>
      );
    }
    case "likes": {
      if (profile.diaryHidden) return privateDiary;
      const likes = await tabReads.likes(requested, page);
      inRange(likes);
      if (!likes || likes.total === 0) return <EmptyState>{t("profile.likesEmpty")}</EmptyState>;
      return (
        <>
          <ul className={gridClasses}>
            {likes.items.map(({ release }) => (
              <li key={release.id} className="flex flex-col gap-3">
                <ReleaseTile release={release} />
                {profile.isOwner && (
                  <ShelfPicker
                    release={{ id: release.id, title: release.title }}
                    shelf={profile.shelf}
                    variant="ghost"
                    className="relative z-10 px-2 py-1 text-xs"
                  />
                )}
              </li>
            ))}
          </ul>
          {pagination(likes)}
        </>
      );
    }
    case "to-listen": {
      if (profile.diaryHidden) return privateDiary;
      const queue = await tabReads["to-listen"](requested, page);
      inRange(queue);
      if (!queue || queue.total === 0) {
        return <EmptyState>{t("profile.toListenEmpty")}</EmptyState>;
      }
      return (
        <>
          <ul className={gridClasses}>
            {queue.items.map((release) => (
              <li key={release.id}>
                <ReleaseTile release={release} />
              </li>
            ))}
          </ul>
          {pagination(queue)}
        </>
      );
    }
    case "reviews": {
      const reviews = await tabReads.reviews(requested, page);
      inRange(reviews);
      if (!reviews || reviews.total === 0) {
        return <EmptyState>{t("profile.reviewsEmpty")}</EmptyState>;
      }
      return (
        <>
          <ul className="space-y-4">
            {reviews.items.map((review) => (
              <li key={review.id} className="empty:hidden">
                <ReviewCard review={review} editable={profile.isOwner} />
              </li>
            ))}
          </ul>
          {pagination(reviews)}
        </>
      );
    }
    case "lists": {
      const lists = await tabReads.lists(requested, page);
      inRange(lists);
      const create = profile.isOwner && (
        <div className="mb-5 flex justify-end">
          <ButtonLink href="/list/new" variant="outline">
            {t("list.create")}
          </ButtonLink>
        </div>
      );
      if (!lists || lists.total === 0) {
        return (
          <>
            {create}
            <EmptyState>{t(profile.isOwner ? "list.emptyOwn" : "profile.listsEmpty")}</EmptyState>
          </>
        );
      }
      return (
        <>
          {create}
          <ul className="grid gap-4 sm:grid-cols-2">
            {lists.items.map((list) => (
              <li key={list.id} className="empty:hidden">
                <ListCard list={list} />
              </li>
            ))}
          </ul>
          {pagination(lists)}
        </>
      );
    }
    case "stats": {
      if (profile.statsHidden) {
        return <EmptyState>{t("profile.statsPrivate", { name: profile.displayName })}</EmptyState>;
      }
      const stats = await getStats(requested);
      const total = stats?.base.listenedTotal;
      if (!stats || !total || total.album + total.ep + total.single + total.track === 0) {
        return <EmptyState>{t("stats.empty")}</EmptyState>;
      }
      return <StatsPanel stats={stats.base} />;
    }
  }
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { locale, username } = await params;
  initRouteLocale(locale);
  const raw = await searchParams;
  const tab = TABS.find((x) => x === firstParam(raw.tab)) ?? "diary";
  const page = pageParam(raw.page);
  const parsed = usernameSchema.safeParse(decodeURIComponent(username));
  if (!parsed.success) notFound();
  const requested = parsed.data;
  // The open tab's data is read alongside the profile (stats keep their own cache).
  if (tab !== "stats") tabReads[tab](requested, page).catch(() => {});

  const [profile, t, format, me, stats] = await Promise.all([
    getProfile(username),
    getTranslations(),
    getFormatter(),
    getApi().then((api) => api.account.me()),
    getStats(requested),
  ]);
  if (!profile) notFound();
  const signedIn = Boolean(me?.profile);
  const path = `/u/${profile.username}`;
  const countLink = "hover:text-fg underline-offset-2 hover:underline";
  const tabLabels: Record<Tab, string> = {
    diary: t("profile.tabs.diary"),
    likes: t("profile.tabs.likes"),
    "to-listen": t("profile.tabs.toListen"),
    reviews: t("profile.tabs.reviews"),
    lists: t("profile.tabs.lists"),
    stats: t("profile.tabs.stats"),
  };

  const filledShelf = profile.shelf.some((slot) => slot !== null);
  const year = stats ? String(stats.base.year) : "";

  const nameLayout = profileNameLayout(profile.displayName);

  return (
    <div className="space-y-12 md:space-y-16">
      <header className="space-y-6">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-4 md:gap-6",
              nameLayout.stacked && "max-md:flex-col max-md:items-start",
            )}
          >
            <Avatar
              name={profile.displayName}
              seed={profile.username}
              src={profile.avatarUrl}
              className="size-20 shrink-0 text-3xl md:size-28 md:text-5xl"
            />
            <div className="min-w-0">
              <h1
                className={cn(
                  "font-display leading-[0.95] font-extrabold tracking-[-0.03em] break-words",
                  nameLayout.size,
                )}
              >
                {profile.displayName}
              </h1>
              <p className="mt-1 font-mono text-sm text-fg-muted">@{profile.username}</p>
            </div>
          </div>
          <div className="flex basis-full items-start gap-2 sm:basis-auto">
            {profile.isOwner && (
              <ButtonLink href="/settings" variant="secondary">
                {t("nav.settings")}
              </ButtonLink>
            )}
            {!profile.isOwner && profile.canInteract && (
              <FollowButton
                username={profile.username}
                name={profile.displayName}
                following={profile.viewerFollows}
              />
            )}
            {!profile.isOwner && !signedIn && (
              <Link href="/sign-in" className={buttonClasses("primary")}>
                {t("social.follow")}
                <span className="sr-only"> {profile.displayName}</span>
              </Link>
            )}
            {!profile.isOwner && signedIn && (
              <MemberMenu
                username={profile.username}
                name={profile.displayName}
                blocked={profile.viewerBlocked}
              />
            )}
          </div>
        </div>
        {profile.bio && (
          <p className="max-w-2xl text-[15px] text-pretty md:text-base">{profile.bio}</p>
        )}
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-muted">
          <FollowerCountLink
            href={`${path}/followers`}
            username={profile.username}
            followerCount={profile.followerCount}
            viewerFollows={profile.viewerFollows}
            className={countLink}
          />
          <Link href={`${path}/following`} className={countLink}>
            {t("profile.following", { count: profile.followingCount })}
          </Link>
          <span>
            {t("profile.joined", {
              date: format.dateTime(new Date(`${profile.joinedOn}T12:00:00Z`), {
                month: "long",
                year: "numeric",
              }),
            })}
          </span>
        </p>
      </header>

      {stats && (
        <section aria-labelledby="figures">
          <h2 id="figures" className="sr-only">
            {t("profile.figures.label")}
          </h2>
          <dl className="grid grid-cols-3 gap-2.5 md:gap-5">
            <Figure
              accent
              value={releaseCount(stats.base.listenedThisYear)}
              label={t("profile.figures.thisYear", {
                count: releaseCount(stats.base.listenedThisYear),
                year,
              })}
            />
            <Figure
              value={releaseCount(stats.base.listenedTotal)}
              label={t("profile.figures.total", { count: releaseCount(stats.base.listenedTotal) })}
            />
            <Figure
              value={stats.base.ratingDistribution.reduce((sum, n) => sum + n, 0)}
              label={t("profile.figures.rated", {
                count: stats.base.ratingDistribution.reduce((sum, n) => sum + n, 0),
              })}
            />
          </dl>
        </section>
      )}

      {(profile.isOwner || filledShelf) && (
        <section aria-labelledby="shelf">
          {profile.isOwner ? (
            <ShelfEditor shelf={profile.shelf} headingId="shelf" title={t("profile.shelfTitle")} />
          ) : (
            <>
              <SectionHeading id="shelf" className="mb-1">
                {t("profile.shelfTitle")}
              </SectionHeading>
              <p className="mb-4 font-mono text-xs tracking-[0.14em] text-fg-muted uppercase">
                {t("shelf.subtitle", { name: profile.displayName })}
              </p>
              <ShelfGrid items={profile.shelf} />
            </>
          )}
        </section>
      )}

      {profile.recent.length > 0 && (
        <section aria-labelledby="recent">
          <SectionHeading id="recent">{t("profile.recentTitle")}</SectionHeading>
          <ul className={gridClasses}>
            {profile.recent.map((entry) => (
              <li key={entry.id}>
                <ReleaseTile release={entry.release} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="profile-sections" id="sections">
        <h2 id="profile-sections" className="sr-only">
          {t("profile.tabsLabel")}
        </h2>
        <LinkTabs
          label={t("profile.tabsLabel")}
          current={tab}
          tabs={TABS.map((id) => ({
            id,
            label: tabLabels[id],
            href: hrefWith(path, { tab: id === "diary" ? null : id }),
          }))}
        />
        <div className="pt-5">
          <TabContent profile={profile} requestedUsername={requested} tab={tab} page={page} />
        </div>
      </section>
    </div>
  );
}
