import { cursorSchema, usernameSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { LinkTabs } from "@/components/ui/LinkTabs";
import { initRouteLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { loadCursorPage } from "@/lib/api-errors";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

import { MemberRow } from "./MemberRow";

/* Followers and following pages of a profile (`/u/[username]/followers|following`). */

export type FollowListProps = {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<SearchParams>;
};
type Direction = "followers" | "following";

const getProfile = cache(async (username: string) => {
  const parsed = usernameSchema.safeParse(decodeURIComponent(username));
  if (!parsed.success) return null;
  return (await getApi()).profile.byUsername({ username: parsed.data });
});

export async function followListMetadata(
  { params }: FollowListProps,
  direction: Direction,
): Promise<Metadata> {
  const profile = await getProfile((await params).username);
  if (!profile) return {};
  const t = await getTranslations("social");
  // Lists of names: thin pages, never worth indexing.
  return { title: t(`${direction}Title`, { name: profile.displayName }), robots: { index: false } };
}

const linkClasses = "text-link underline-offset-2 hover:underline";

export async function FollowListPage({
  params,
  searchParams,
  direction,
}: FollowListProps & { direction: Direction }) {
  const { locale, username } = await params;
  initRouteLocale(locale);
  const profile = await getProfile(username);
  if (!profile) notFound();
  const parsedCursor = cursorSchema.safeParse(firstParam((await searchParams).after));
  const api = await getApi();
  const [{ page, cursor }, me] = await Promise.all([
    loadCursorPage(parsedCursor.success ? parsedCursor.data : undefined, (c) => {
      const input = { username: profile.username, cursor: c };
      return direction === "followers" ? api.social.followers(input) : api.social.following(input);
    }),
    api.account.me(),
  ]);
  if (!page) notFound();
  const t = await getTranslations("social");
  const path = `/u/${profile.username}`;
  const name = profile.displayName;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link href={path} className="text-sm text-fg-muted hover:text-fg">
          ← {t("backToProfile", { name })}
        </Link>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] text-balance break-words">
          {t(`${direction}Title`, { name })}
        </h1>
      </header>
      <LinkTabs
        label={t("followTabsLabel")}
        current={direction}
        tabs={[
          {
            id: "followers",
            label: t("followersTab", { count: profile.followerCount }),
            href: `${path}/followers`,
          },
          {
            id: "following",
            label: t("followingTab", { count: profile.followingCount }),
            href: `${path}/following`,
          },
        ]}
      />
      {page.items.length === 0 && !cursor ? (
        <p className="py-6 text-lg text-fg-muted">{t(`${direction}Empty`, { name })}</p>
      ) : (
        <ul className="space-y-2">
          {page.items.map((member) => (
            <li key={member.username} className="rounded-card-sm bg-surface px-4">
              <MemberRow member={member} signedIn={Boolean(me?.profile)} />
            </li>
          ))}
        </ul>
      )}
      {(cursor || page.nextCursor) && (
        <nav aria-label={t("pagingLabel")} className="flex justify-between text-sm">
          {cursor ? (
            <Link href={`${path}/${direction}`} className={linkClasses}>
              ↑ {t("first")}
            </Link>
          ) : (
            <span />
          )}
          {page.nextCursor && (
            <Link
              href={hrefWith(`${path}/${direction}`, { after: page.nextCursor })}
              rel="next"
              className={linkClasses}
            >
              {t("more")} ↓
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
