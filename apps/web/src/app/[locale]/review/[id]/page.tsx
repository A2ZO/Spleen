import { cursorSchema, ratingToStars, reviewUpdateSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { DetailBar } from "@/components/detail/DetailBar";
import { moreMenuItem } from "@/components/detail/MoreMenu";
import { CommentForm, CommentItem } from "@/components/social/Comments";
import { LikeButton } from "@/components/social/LikeButton";
import { ModerationBanner } from "@/components/social/ModerationBanner";
import { ReportButton } from "@/components/social/ReportDialog";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { CommentIcon, HeartIcon } from "@/components/ui/icons";
import { pillClasses } from "@/components/ui/Pill";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { seoMetadata } from "@/lib/seo";
import { Link } from "@/i18n/navigation";
import { loadCursorPage } from "@/lib/api-errors";
import { firstParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
};

const getReview = cache(async (id: string) => {
  if (!reviewUpdateSchema.shape.id.safeParse(id).success) return null;
  return (await getApi()).review.byId({ id });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = metadataLocale(rawLocale);
  const detail = await getReview(id);
  if (!detail) return {};
  const t = await getTranslations({ locale });
  const { review } = detail;
  const about = review.track?.title ?? review.release.title;
  const title = t("review.pageTitle", { name: review.author.displayName, title: about });
  const excerpt = review.body.replace(/\s+/g, " ").trim();
  const description =
    excerpt.length > 0
      ? excerpt.length > 160
        ? `${excerpt.slice(0, 159).trimEnd()}…`
        : excerpt
      : t("seo.review", { title: about, name: review.author.displayName });
  return {
    title,
    description,
    // A hidden review reaches this page for its author only: `seo.page` says noindex.
    ...(await seoMetadata(locale, `/review/${id}`, {
      subject: { kind: "review", key: id },
      title,
      description,
    })),
  };
}

const linkClasses = "text-link underline-offset-2 hover:underline";

/** A review with its likes and comments (paged with a cursor, oldest first). */
export default async function ReviewPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  initRouteLocale(locale);
  const detail = await getReview(id);
  if (!detail) notFound();
  const raw = await searchParams;
  const parsedCursor = cursorSchema.safeParse(firstParam(raw.after));

  const api = await getApi();
  const me = await api.account.me();
  const subject = { kind: "review" as const, id };
  const { page: comments, cursor } = await loadCursorPage(
    parsedCursor.success ? parsedCursor.data : undefined,
    (c) => api.comment.list({ subject, cursor: c }),
  );
  const t = await getTranslations();
  const format = await getFormatter();
  const { review } = detail;
  const { release } = review;
  const itemHref = review.track ? `/track/${review.track.slug}` : `/album/${release.slug}`;
  const signedIn = Boolean(me?.profile);
  const path = `/review/${id}`;
  const rating = review.rating;
  const stars =
    rating === null
      ? null
      : format.number(ratingToStars(rating), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
  const action = detail.isOwner ? (
    <Link href={`/review/${id}/edit`} className={moreMenuItem}>
      {t("review.edit")}
    </Link>
  ) : signedIn ? (
    <ReportButton subject={{ kind: "review", id }} variant="menu" />
  ) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <DetailBar backHref={itemHref} label={t("detail.review")} actions={action} />
      {detail.hidden && <ModerationBanner hold={detail.hidden} subject="review" className="mb-6" />}
      <article>
        <header className="flex items-center gap-4 md:gap-6">
          <Link href={itemHref} className="w-20 shrink-0 md:w-32" tabIndex={-1} aria-hidden="true">
            <Cover
              slug={release.slug}
              title={release.title}
              coverUrl={release.coverUrl}
              showText={false}
              sizes="128px"
              className="rounded-2xl! md:rounded-card-sm!"
            />
          </Link>
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-[0.06em] text-fg-muted uppercase max-md:hidden">
              {t("detail.review")}
            </p>
            <h1 className="font-display text-[32px] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance [overflow-wrap:anywhere] md:mt-2 md:text-[56px]">
              <Link href={itemHref} className="hover:text-link">
                {review.track?.title ?? release.title}
              </Link>
            </h1>
            <p className="mt-1.5 text-fg-muted md:text-lg">
              {release.artists.map((a) => a.name).join(", ")}
            </p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href={`/u/${review.author.username}`}
            className="flex items-center gap-2.5 font-medium hover:text-link"
          >
            <Avatar
              name={review.author.displayName}
              seed={review.author.username}
              src={review.author.avatarUrl}
              className="mb-0! size-9! text-xs"
            />
            <span>{t("review.byline", { name: review.author.displayName })}</span>
          </Link>
          <time dateTime={review.createdAt} className="font-mono text-xs text-fg-muted">
            {format.dateTime(new Date(review.createdAt), { dateStyle: "long" })}
          </time>
          {rating === null && (
            <span className="text-xs text-fg-muted">
              {release.ratingsHidden ? t("review.ratingHidden") : t("review.noRating")}
            </span>
          )}
        </div>

        <div
          className={cn(
            "mt-6 grid gap-3 md:gap-5",
            stars !== null && "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
          )}
        >
          <Card>
            <p
              lang={review.lang}
              className="text-[17px] leading-relaxed break-words whitespace-pre-line text-pretty md:text-lg"
            >
              {review.body}
            </p>
          </Card>
          {stars !== null && (
            <Card
              tone="accent"
              role="region"
              aria-labelledby="their-rating"
              className="flex flex-col gap-3 max-md:row-start-1"
            >
              <h2
                id="their-rating"
                className="font-mono text-[11px] font-normal tracking-[0.06em] uppercase md:text-xs"
              >
                {t("detail.theirRating")}
              </h2>
              <p className="font-display text-[64px] leading-[0.8] font-extrabold tracking-[-0.04em] md:text-[96px]">
                {stars}
                <span className="sr-only"> {t("detail.outOfFive")}</span>
              </p>
              <Stars rating={rating} tone="on-accent" className="text-2xl" />
            </Card>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5 text-sm text-fg-muted">
          {detail.canLike ? (
            <LikeButton subject={subject} liked={detail.viewerLiked} count={review.likeCount} />
          ) : (
            <span className={pillClasses("outline", "min-h-11 text-fg-muted!")}>
              <HeartIcon /> {t("review.likes", { count: review.likeCount })}
            </span>
          )}
          <span className={pillClasses("outline", "min-h-11 text-fg-muted!")}>
            <CommentIcon /> {t("review.comments", { count: review.commentCount })}
          </span>
          {detail.isOwner && (
            <Link
              href={`/review/${id}/edit`}
              className={buttonClasses("secondary", "max-md:hidden", "sm")}
            >
              {t("review.edit")}
            </Link>
          )}
          {signedIn && !detail.isOwner && (
            <div className="ml-auto max-md:hidden">
              <ReportButton subject={{ kind: "review", id }} />
            </div>
          )}
        </div>
      </article>

      <section aria-labelledby="comments" className="mt-14 space-y-4 md:mt-20">
        <SectionHeading id="comments" className="mb-2">
          {t("comments.title")}
        </SectionHeading>
        {comments.items.length === 0 && !cursor ? (
          <p className="text-fg-muted">{t("comments.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {comments.items.map((comment) => (
              <li
                key={comment.id}
                className="rounded-card-sm border border-border bg-surface p-4 empty:hidden md:p-5"
              >
                <CommentItem comment={comment} canReport={signedIn} />
              </li>
            ))}
          </ul>
        )}
        {(cursor || comments.nextCursor) && (
          <nav aria-label={t("comments.pagingLabel")} className="flex justify-between text-sm">
            {cursor ? (
              <Link href={path} scroll={false} className={linkClasses}>
                ↑ {t("comments.first")}
              </Link>
            ) : (
              <span />
            )}
            {comments.nextCursor && (
              <Link
                href={hrefWith(path, { after: comments.nextCursor })}
                scroll={false}
                rel="next"
                className={linkClasses}
              >
                {t("comments.more")} ↓
              </Link>
            )}
          </nav>
        )}
        {detail.canComment ? (
          <Card>
            <CommentForm subject={subject} />
          </Card>
        ) : detail.hidden ? null : me?.profile ? (
          <p className="text-sm text-fg-muted">{t("comments.unavailable")}</p>
        ) : (
          <p className="text-sm text-fg-muted">
            <Link href="/sign-in" className={linkClasses}>
              {t("comments.signIn")}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
