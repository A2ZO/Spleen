import type { ReviewCard as Review } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { CommentIcon, HeartIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/Stars";
import { UndoableGate } from "@/components/ui/UndoableGate";
import { Link } from "@/i18n/navigation";

export function ReviewCard({
  review,
  showRelease = true,
  editable = false,
}: {
  review: Review;
  showRelease?: boolean;
  /** The viewer wrote it: show a link to the edit screen. */
  editable?: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <UndoableGate id={review.id}>
      <Card className="flex gap-4">
        {showRelease && (
          <Link
            href={`/album/${review.release.slug}`}
            className="w-16 shrink-0 sm:w-20"
            tabIndex={-1}
            // Same destination as the title link next to it: out of the tab order and of screen readers.
            aria-hidden="true"
          >
            <Cover
              slug={review.release.slug}
              title={review.release.title}
              coverUrl={review.release.coverUrl}
              showText={false}
            />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {showRelease && (
            <h3 className="font-serif text-lg leading-tight">
              <Link
                href={
                  review.track ? `/track/${review.track.slug}` : `/album/${review.release.slug}`
                }
                className="hover:text-star"
              >
                {review.track?.title ?? review.release.title}
              </Link>{" "}
              <span className="font-sans text-sm text-fg-muted">
                {review.release.artists.map((a) => a.name).join(", ")}
              </span>
            </h3>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link
              href={`/u/${review.author.username}`}
              className="flex items-center gap-2 text-fg-muted hover:text-fg"
            >
              <Avatar
                name={review.author.displayName}
                seed={review.author.username}
                src={review.author.avatarUrl}
                className="size-6 text-xs"
              />
              <span>{t("review.byline", { name: review.author.displayName })}</span>
            </Link>
            {review.rating !== null ? (
              <span className="flex items-center gap-1">
                <Stars rating={review.rating} className="text-sm" />
                <span className="sr-only">
                  {t("rating.outOfFive", { stars: format.number(ratingToStars(review.rating)) })}
                </span>
              </span>
            ) : (
              <span className="text-xs text-fg-muted italic">{t("review.noRating")}</span>
            )}
            <time dateTime={review.createdAt} className="font-mono text-xs text-fg-muted">
              {format.dateTime(new Date(review.createdAt), { dateStyle: "medium" })}
            </time>
            {review.hidden && (
              <Badge className="border-star/60 text-star">{t("moderationHold.badge")}</Badge>
            )}
          </div>
          <p lang={review.lang} className="mt-3 leading-relaxed text-pretty">
            {review.body}
          </p>
          <p className="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted">
            <Link
              href={`/review/${review.id}`}
              className="flex items-center gap-4 rounded-sm hover:text-fg"
            >
              <span className="flex items-center gap-1">
                <HeartIcon
                  filled={review.viewerLiked}
                  className={review.viewerLiked ? "text-star" : undefined}
                />{" "}
                {t("review.likes", { count: review.likeCount })}
              </span>
              <span className="flex items-center gap-1">
                <CommentIcon /> {t("review.comments", { count: review.commentCount })}
              </span>
              <span className="text-link">
                {t("review.open")}
                <span className="sr-only"> ({review.release.title})</span>
              </span>
            </Link>
            {editable && (
              <Link
                href={`/review/${review.id}/edit`}
                className="ml-auto text-link underline-offset-2 hover:underline"
              >
                {t("review.edit")}
                <span className="sr-only"> ({review.release.title})</span>
              </Link>
            )}
          </p>
        </div>
      </Card>
    </UndoableGate>
  );
}
