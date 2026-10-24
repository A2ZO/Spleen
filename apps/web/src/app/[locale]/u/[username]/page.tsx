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
import { ShelfPicker } from "@/components/shelf/ShelfPicker";
import { ListCard } from "@/components/social/ListCard";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Avatar } from "@/components/ui/Avatar";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VinylShelf } from "@/components/ui/VinylShelf";
import { initRouteLocale } from "@/i18n/locale";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return {};
  return { title: `${profile.displayName} (@${profile.username})` };
}

const TABS = ["diary", "likes", "to-listen", "reviews", "lists", "stats"] as const;
type Tab = (typeof TABS)[number];

const gridClasses = "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5";

function EmptyState({ children }: { children: string }) {
  return <p className="py-6 font-serif text-lg text-fg-muted italic">{children}</p>;
}

/** Only the active tab is loaded; each one is a link (`?tab=…&page=…`). */
async function TabContent({
  profile,
  tab,
  page,
}: {
  profile: ProfileDetail;
  tab: Tab;
  page: number;
}) {
  const t = await getTranslations();
  const api = await getApi();
  const username = profile.username;
  const path = `/u/${username}`;
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
      const diary = await api.profile.diary({ username, page });
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
      const likes = await api.profile.likes({ username, page });
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
      const queue = await api.profile.toListen({ username, page });
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
      const reviews = await api.profile.reviews({ username, page });
      inRange(reviews);
      if (!reviews || reviews.total === 0) {
        return <EmptyState>{t("profile.reviewsEmpty")}</EmptyState>;
      }
      return (
        <>
          <ul className="space-y-4">
            {reviews.items.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} editable={profile.isOwner} />
              </li>
            ))}
          </ul>
          {pagination(reviews)}
        </>
      );
    }
    case "lists": {
      const lists = (await api.profile.lists({ username })) ?? [];
      if (lists.length === 0) return <EmptyState>{t("profile.listsEmpty")}</EmptyState>;
      return (
        <ul className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} />
            </li>
          ))}
        </ul>
      );
    }
    case "stats": {
      if (profile.statsHidden) {
        return <EmptyState>{t("profile.statsPrivate", { name: profile.displayName })}</EmptyState>;
      }
      const stats = await api.profile.stats({ username });
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
  const profile = await getProfile(username);
  if (!profile) notFound();
  const raw = await searchParams;
  const tab = TABS.find((x) => x === firstParam(raw.tab)) ?? "diary";
  const page = pageParam(raw.page);

  const t = await getTranslations();
  const format = await getFormatter();
  const path = `/u/${profile.username}`;
  const tabLabels: Record<Tab, string> = {
    diary: t("profile.tabs.diary"),
    likes: t("profile.tabs.likes"),
    "to-listen": t("profile.tabs.toListen"),
    reviews: t("profile.tabs.reviews"),
    lists: t("profile.tabs.lists"),
    stats: t("profile.tabs.stats"),
  };

  return (
    <div className="space-y-16">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar
          name={profile.displayName}
          seed={profile.username}
          src={profile.avatarUrl}
          className="size-20 text-3xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-semibold">{profile.displayName}</h1>
          <p className="font-mono text-sm text-fg-muted">@{profile.username}</p>
          <p className="mt-3 max-w-2xl text-pretty">{profile.bio}</p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
            <span>{t("profile.followers", { count: profile.followerCount })}</span>
            <span>{t("profile.following", { count: profile.followingCount })}</span>
            <span>
              {t("profile.joined", {
                date: format.dateTime(new Date(`${profile.joinedOn}T12:00:00Z`), {
                  month: "long",
                  year: "numeric",
                }),
              })}
            </span>
          </p>
        </div>
      </header>

      <section aria-labelledby="shelf">
        <SectionHeading id="shelf" className="mb-2">
          {t("profile.shelfTitle")}
        </SectionHeading>
        <p className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
          {profile.isOwner
            ? t("shelf.subtitleOwn")
            : t("shelf.subtitle", { name: profile.displayName })}
        </p>
        {profile.isOwner ? (
          <ShelfEditor shelf={profile.shelf} />
        ) : (
          <VinylShelf
            items={profile.shelf}
            emptyMessage={t("profile.shelfEmpty", { name: profile.displayName })}
            className="pt-4"
          />
        )}
      </section>

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
          <TabContent profile={profile} tab={tab} page={page} />
        </div>
      </section>
    </div>
  );
}
