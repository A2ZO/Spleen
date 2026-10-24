import type { FeedItem } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { CommentIcon, HeartIcon, RepeatIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/Stars";
import { Link } from "@/i18n/navigation";

import { ReviewCard } from "./ReviewCard";

type Listen = Extract<FeedItem, { kind: "listen" }>;

/** What the friend did: listened, listened again, hearted or rated. */
function verbKey(item: Listen) {
  if (item.listenedOn) return item.relisten ? "relistened" : "listened";
  return item.liked ? "hearted" : "rated";
}

/** One item of the friends feed: a listen (with its review) or a review on its own. */
export function FeedItemCard({ item, now }: { item: FeedItem; now: Date }) {
  const t = useTranslations();
  const format = useFormatter();
  if (item.kind === "review") return <ReviewCard review={item.review} />;

  const { author, release, review } = item;
  const href = item.track ? `/track/${item.track.slug}` : `/album/${release.slug}`;
  return (
    <Card className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
        <Link href={`/u/${author.username}`} className="flex items-center gap-2 hover:text-fg">
          <Avatar
            name={author.displayName}
            seed={author.username}
            src={author.avatarUrl}
            className="size-6 text-xs"
          />
          <span className="font-medium text-fg">{author.displayName}</span>
        </Link>
        <span>{t(`feed.${verbKey(item)}`)}</span>
        {/* The feed is ordered by activity; a listen may be logged days after it happened. */}
        <time dateTime={item.at} className="ml-auto font-mono text-xs">
          {format.relativeTime(new Date(item.at), now)}
        </time>
      </p>
      <div className="flex gap-4">
        <Link href={href} className="w-16 shrink-0 sm:w-20" tabIndex={-1}>
          <Cover
            slug={release.slug}
            title={release.title}
            coverUrl={release.coverUrl}
            showText={false}
            sizes="80px"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg leading-tight">
            <Link href={href} className="hover:text-star">
              {item.track?.title ?? release.title}
            </Link>{" "}
            <span className="font-sans text-sm text-fg-muted">
              {release.artists.map((a) => a.name).join(", ")}
            </span>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
            {item.listenedOn && (
              <time dateTime={item.listenedOn} className="font-mono text-xs">
                {t("feed.listenedOn", {
                  date: format.dateTime(new Date(`${item.listenedOn}T12:00:00Z`), {
                    dateStyle: "medium",
                  }),
                })}
              </time>
            )}
            {item.rating !== null && (
              <span className="flex items-center gap-1">
                <Stars rating={item.rating} className="text-sm" />
                <span className="sr-only">
                  {t("rating.outOfFive", { stars: format.number(ratingToStars(item.rating)) })}
                </span>
              </span>
            )}
            {item.liked && (
              <HeartIcon
                filled
                className="text-star"
                aria-label={t("profile.liked")}
                aria-hidden={false}
                role="img"
              />
            )}
            {item.relisten && (
              <RepeatIcon aria-label={t("feed.relisten")} aria-hidden={false} role="img" />
            )}
          </p>
          {review && (
            <div className="mt-3">
              <p lang={review.lang} className="line-clamp-4 leading-relaxed text-pretty">
                {review.body}
              </p>
              <Link
                href={`/review/${review.id}`}
                className="mt-2 inline-flex items-center gap-3 text-xs text-fg-muted hover:text-fg"
              >
                <span className="flex items-center gap-1">
                  <HeartIcon /> {t("review.likes", { count: review.likeCount })}
                </span>
                <span className="flex items-center gap-1">
                  <CommentIcon /> {t("review.comments", { count: review.commentCount })}
                </span>
                <span className="text-link">{t("review.open")}</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
