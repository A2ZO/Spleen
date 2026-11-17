import type { ReleaseFriends } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/Avatar";
import { HeartIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";
import { Link } from "@/i18n/navigation";

/** Rows shown before « Voir tous » (`RELEASE_FRIENDS_SHOWN` in the API). */
const SHOWN = 5;

/**
 * « Tes amis sur ce disque »: the followed members' ratings and hearts, as rows (never a
 * whole card as a link). Plain links open and close the full list, without JavaScript.
 */
export function FriendsOnRecord({
  friends,
  slug,
  open,
}: {
  friends: ReleaseFriends;
  slug: string;
  open: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const more = friends.total - friends.items.length;
  const linkClass =
    "inline-flex min-h-11 items-center text-sm font-medium underline decoration-1 underline-offset-4 hover:text-link";

  return (
    <section aria-labelledby="friends" className="mt-14 md:mt-20">
      <SectionHeading id="friends">{t("album.friendsTitle")}</SectionHeading>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2 lg:grid-cols-3">
        {friends.items.map(({ member, rating, liked }) => (
          <li key={member.username} className="flex min-w-0 items-center gap-3 py-2">
            <Avatar
              name={member.displayName}
              seed={member.username}
              src={member.avatarUrl}
              className="mb-0 size-10"
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/u/${member.username}`}
                className="inline-flex min-h-11 max-w-full items-center font-medium hover:text-star"
              >
                <span className="truncate">{member.displayName}</span>
              </Link>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              {rating !== null && (
                <span className="flex items-center">
                  <Stars rating={rating} className="text-sm" />
                  <span className="sr-only">
                    {t("rating.outOfFive", { stars: format.number(ratingToStars(rating)) })}
                  </span>
                </span>
              )}
              {liked && (
                <HeartIcon
                  filled
                  className="text-star"
                  aria-label={t("profile.liked")}
                  aria-hidden={false}
                  role="img"
                />
              )}
            </span>
          </li>
        ))}
      </ul>
      {friends.total > SHOWN && (
        <p className="mt-3 flex flex-wrap items-center gap-x-6">
          {open ? (
            <>
              {more > 0 && (
                <span className="text-sm text-fg-muted">
                  {t("album.friendsOthers", { count: more })}
                </span>
              )}
              <Link href={`/album/${slug}#friends`} className={linkClass}>
                {t("album.friendsLess")}
              </Link>
            </>
          ) : (
            <Link href={`/album/${slug}?friends=all#friends`} className={linkClass}>
              {t("album.friendsAll", { total: friends.total })}
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
