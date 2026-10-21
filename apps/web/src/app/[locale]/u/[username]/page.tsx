import { usernameSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { DiaryList } from "@/components/profile/DiaryList";
import { StatsPanel } from "@/components/profile/StatsPanel";
import { ReleaseTile } from "@/components/release/ReleaseTile";
import { ListCard } from "@/components/social/ListCard";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Avatar } from "@/components/ui/Avatar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";
import { VinylShelf } from "@/components/ui/VinylShelf";
import { initRouteLocale } from "@/i18n/locale";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string; username: string }> };

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

function EmptyState({ children }: { children: string }) {
  return <p className="py-6 font-serif text-lg text-fg-muted italic">{children}</p>;
}

export default async function ProfilePage({ params }: Props) {
  const { locale, username } = await params;
  initRouteLocale(locale);
  const profile = await getProfile(username);
  if (!profile) notFound();

  const t = await getTranslations();
  const format = await getFormatter();

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
        <SectionHeading id="shelf">{t("profile.shelfTitle")}</SectionHeading>
        <VinylShelf
          items={profile.shelf}
          emptyMessage={t("profile.shelfEmpty", { name: profile.displayName })}
          className="pt-4"
        />
      </section>

      {profile.recent.length > 0 && (
        <section aria-labelledby="recent">
          <SectionHeading id="recent">{t("profile.recentTitle")}</SectionHeading>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {profile.recent.map((entry) => (
              <li key={entry.id}>
                <ReleaseTile release={entry.release} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs
        label={t("profile.tabsLabel")}
        items={[
          {
            id: "diary",
            label: t("profile.tabs.diary"),
            content:
              profile.diary.length > 0 ? (
                <DiaryList entries={profile.diary} />
              ) : (
                <EmptyState>{t("profile.diaryEmpty")}</EmptyState>
              ),
          },
          {
            id: "reviews",
            label: t("profile.tabs.reviews"),
            content:
              profile.reviews.length > 0 ? (
                <ul className="space-y-4">
                  {profile.reviews.map((review) => (
                    <li key={review.id}>
                      <ReviewCard review={review} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>{t("profile.reviewsEmpty")}</EmptyState>
              ),
          },
          {
            id: "lists",
            label: t("profile.tabs.lists"),
            content:
              profile.lists.length > 0 ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {profile.lists.map((list) => (
                    <li key={list.id}>
                      <ListCard list={list} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>{t("profile.listsEmpty")}</EmptyState>
              ),
          },
          {
            id: "stats",
            label: t("profile.tabs.stats"),
            content:
              profile.diary.length > 0 ? (
                <StatsPanel stats={profile.stats} />
              ) : (
                <EmptyState>{t("stats.empty")}</EmptyState>
              ),
          },
        ]}
      />
    </div>
  );
}
