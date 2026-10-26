import type { ModerationNotice, NotificationGroup } from "@spleen/api";
import { cursorSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { MarkAllReadButton } from "@/components/social/ActionButtons";
import { Avatar } from "@/components/ui/Avatar";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { loadCursorPage } from "@/lib/api-errors";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = metadataLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "notifications" });
  return { title: t("title"), robots: { index: false } };
}

const linkClasses = "text-link underline-offset-2 hover:underline";

/** Where a notification leads: the review / list, or the newest follower's profile. */
function hrefOf(group: NotificationGroup): string {
  if (group.review) return `/review/${group.review.id}`;
  if (group.list) return `/list/${group.list.id}`;
  return group.actors[0] ? `/u/${group.actors[0].username}` : "/notifications";
}

export default async function NotificationsPage({ params, searchParams }: Props) {
  const locale = initRouteLocale((await params).locale);
  const api = await getApi();
  const me = await api.account.me();
  if (!me) return redirect({ href: "/sign-in", locale });
  if (!me.profile) return redirect({ href: "/welcome", locale });
  const parsedCursor = cursorSchema.safeParse(firstParam((await searchParams).after));
  const [{ page, cursor }, unread] = await Promise.all([
    loadCursorPage(parsedCursor.success ? parsedCursor.data : undefined, (c) =>
      api.notification.list({ cursor: c }),
    ),
    api.notification.unreadCount(),
  ]);
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const now = new Date();

  const text = (group: NotificationGroup) => {
    const values = {
      name: group.actors[0]?.displayName ?? t("someone"),
      others: Math.max(0, group.actorCount - 1),
      title: group.review?.releaseTitle ?? group.list?.title ?? "",
    };
    if (group.type === "follow") return t("follow", values);
    if (group.type === "like") return group.list ? t("likeList", values) : t("like", values);
    return group.list ? t("commentList", values) : t("comment", values);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t("unread", { count: unread })}</p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </header>
      {page.items.length === 0 && !cursor ? (
        <p className="py-6 font-serif text-lg text-fg-muted italic">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {page.items.map((group) =>
            group.moderation ? (
              <li key={group.key}>
                <ModerationItem
                  notice={group.moderation}
                  unread={group.unread}
                  at={group.latestAt}
                />
              </li>
            ) : (
              <li key={group.key}>
                <Link
                  href={hrefOf(group)}
                  className={cn(
                    "flex gap-3 rounded-sm px-2 py-3 hover:bg-surface",
                    group.unread && "bg-surface/60",
                  )}
                >
                  <span className="flex shrink-0 -space-x-3">
                    {group.actors.map((actor) => (
                      <Avatar
                        key={actor.username}
                        name={actor.displayName}
                        seed={actor.username}
                        src={actor.avatarUrl}
                        className="size-9 text-xs"
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-pretty">
                      {group.unread && (
                        <>
                          <span
                            aria-hidden="true"
                            className="mr-2 inline-block size-2 rounded-full bg-star align-middle"
                          />
                          <span className="sr-only">{t("unreadLabel")} </span>
                        </>
                      )}
                      {text(group)}
                    </span>
                    {group.commentExcerpt && (
                      <span className="mt-1 block truncate text-sm text-fg-muted italic">
                        {t("excerpt", { text: group.commentExcerpt })}
                      </span>
                    )}
                    <time
                      dateTime={group.latestAt}
                      className="mt-1 block font-mono text-xs text-fg-muted"
                    >
                      {format.relativeTime(new Date(group.latestAt), now)}
                    </time>
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
      {(cursor || page.nextCursor) && (
        <nav aria-label={t("pagingLabel")} className="flex justify-between text-sm">
          {cursor ? (
            <Link href="/notifications" className={linkClasses}>
              ↑ {t("newest")}
            </Link>
          ) : (
            <span />
          )}
          {page.nextCursor && (
            <Link
              href={hrefWith("/notifications", { after: page.nextCursor })}
              rel="next"
              className={linkClasses}
            >
              {t("older")} ↓
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

/** A moderation decision: what was decided, why, and how to contest it (no link: the content
 * is often hidden or gone). */
async function ModerationItem({
  notice,
  unread,
  at,
}: {
  notice: ModerationNotice;
  unread: boolean;
  at: string;
}) {
  const t = await getTranslations("notifications.moderation");
  const tn = await getTranslations("notifications");
  const format = await getFormatter();
  const mailto = notice.contactEmail.includes("@") ? `mailto:${notice.contactEmail}` : null;
  return (
    <div className={cn("space-y-1 rounded-sm px-2 py-3", unread && "bg-surface/60")}>
      <p className="text-pretty">
        {unread && (
          <>
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2 rounded-full bg-star align-middle"
            />
            <span className="sr-only">{tn("unreadLabel")} </span>
          </>
        )}
        {t(`${notice.action}`, { subject: notice.subject })}
      </p>
      {notice.excerpt && (
        <p className="truncate text-sm text-fg-muted italic">
          {tn("excerpt", { text: notice.excerpt })}
        </p>
      )}
      <p className="text-sm">{t("reason", { reason: notice.reason })}</p>
      {notice.action !== "restore" && notice.action !== "unsuspend" && (
        <p className="text-sm text-fg-muted">
          {t.rich("contest", {
            email: () =>
              mailto ? (
                <a href={mailto} className="text-link underline underline-offset-2">
                  {notice.contactEmail}
                </a>
              ) : (
                <span>{notice.contactEmail}</span>
              ),
          })}
        </p>
      )}
      <time dateTime={at} className="block font-mono text-xs text-fg-muted">
        {format.relativeTime(new Date(at), new Date())}
      </time>
    </div>
  );
}
