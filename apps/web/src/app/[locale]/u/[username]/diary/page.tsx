import { usernameSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { DiaryCalendar } from "@/components/profile/DiaryCalendar";
import { DiaryList } from "@/components/profile/DiaryList";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { seoMetadata } from "@/lib/seo";
import { Link, redirect } from "@/i18n/navigation";
import { currentMonth as thisMonth, shiftMonth } from "@/lib/calendar";
import {
  firstParam,
  hrefWith,
  monthParam,
  pageParam,
  type SearchParams,
} from "@/lib/search-params";
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
  const { locale: rawLocale, username } = await params;
  const locale = metadataLocale(rawLocale);
  const profile = await getProfile(username);
  if (!profile) return {};
  const t = await getTranslations({ locale });
  const title = t("profile.diaryTitle", { name: profile.displayName });
  const description = t("seo.diary", { name: profile.displayName });
  // A private diary is empty for visitors: nothing worth indexing. Its pages and months
  // are views of one diary, reached through links: not indexed separately either.
  return {
    title,
    description,
    ...(await seoMetadata(locale, `/u/${profile.username}/diary`, {
      noindex: profile.diaryHidden,
      title,
      description,
    })),
  };
}

function Empty({ children }: { children: string }) {
  return <p className="font-serif text-lg text-fg-muted italic">{children}</p>;
}

/** Full diary: list view (paginated) or calendar view (one month). Undated listens never show. */
export default async function DiaryPage({ params, searchParams }: Props) {
  const { locale: rawLocale, username } = await params;
  const locale = initRouteLocale(rawLocale);
  const profile = await getProfile(username);
  if (!profile) notFound();
  const t = await getTranslations();
  const raw = await searchParams;
  const view = firstParam(raw.view) === "calendar" ? "calendar" : "list";
  const path = `/u/${profile.username}/diary`;
  // Default month: the latest listen's, else the current one (both are calendar months).
  const currentMonth = thisMonth();
  const month = monthParam(raw.month) ?? profile.recent[0]?.listenedOn.slice(0, 7) ?? currentMonth;

  const api = await getApi();
  const page = pageParam(raw.page);
  const [list, monthEntries] = profile.diaryHidden
    ? [null, null]
    : await Promise.all([
        view === "list" ? api.profile.diary({ username: profile.username, page }) : null,
        view === "calendar" ? api.profile.diaryMonth({ username: profile.username, month }) : null,
      ]);
  // A page past the last one goes to the last page.
  if (list && list.page > list.pageCount) {
    redirect({ href: hrefWith(path, { page: list.pageCount }), locale });
  }

  return (
    <div className="space-y-8">
      <header>
        <Link
          href={`/u/${profile.username}`}
          className="text-sm text-link underline-offset-2 hover:underline"
        >
          {t("profile.diaryBack")}
        </Link>
        <h1 className="mt-2 text-4xl font-semibold">
          {t("profile.diaryTitle", { name: profile.displayName })}
        </h1>
      </header>
      {profile.diaryHidden ? (
        <Empty>{t("profile.diaryPrivate", { name: profile.displayName })}</Empty>
      ) : (
        <>
          <LinkTabs
            label={t("diary.views")}
            current={view}
            tabs={[
              { id: "list", label: t("diary.list"), href: path },
              {
                id: "calendar",
                label: t("diary.calendar"),
                href: hrefWith(path, { view: "calendar", month }),
              },
            ]}
          />
          {list &&
            (list.items.length > 0 ? (
              <div className="space-y-8">
                <DiaryList entries={list.items} />
                <Pagination
                  page={list.page}
                  pageCount={list.pageCount}
                  hrefFor={(p) => hrefWith(path, { page: p })}
                />
              </div>
            ) : (
              <Empty>{t("profile.diaryEmpty")}</Empty>
            ))}
          {monthEntries && (
            <DiaryCalendar
              month={month}
              entries={monthEntries}
              previousHref={hrefWith(path, { view: "calendar", month: shiftMonth(month, -1) })}
              nextHref={
                month < currentMonth
                  ? hrefWith(path, { view: "calendar", month: shiftMonth(month, 1) })
                  : null
              }
            />
          )}
        </>
      )}
    </div>
  );
}
