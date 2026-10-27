import { cursorSchema, ratingToStars, reviewUpdateSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { CommentForm, CommentItem } from "@/components/social/Comments";
import { LikeButton } from "@/components/social/LikeButton";
import { ModerationBanner } from "@/components/social/ModerationBanner";
import { ReportButton } from "@/components/social/ReportDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Cover } from "@/components/ui/Cover";
import { CommentIcon, HeartIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/Stars";
import { initRouteLocale, metadataLocale } from "@/i18n/locale";
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

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {detail.hidden && <ModerationBanner hold={detail.hidden} subject="review" />}
      <article className="space-y-6">
        <header className="flex items-center gap-4">
          <Link href={itemHref} className="w-20 shrink-0 sm:w-24" tabIndex={-1}>
            <Cover
              slug={release.slug}
              title={release.title}
              coverUrl={release.coverUrl}
              showText={false}
              sizes="96px"
            />
          </Link>
          <div className="min-w-0">
            <p className="font-serif text-sm text-fg-muted italic">
              {t("review.byline", { name: review.author.displayName })}
            </p>
            <h1 className="text-3xl font-semibold text-balance">
              <Link href={itemHref} className="hover:text-star">
                {review.track?.title ?? release.title}
              </Link>
            </h1>
            <p className="text-sm text-fg-muted">{release.artists.map((a) => a.name).join(", ")}</p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href={`/u/${review.author.username}`}
            className="flex items-center gap-2 text-fg-muted hover:text-fg"
          >
            <Avatar
              name={review.author.displayName}
              seed={review.author.username}
              src={review.author.avatarUrl}
              className="size-8 text-xs"
            />
            <span>{review.author.displayName}</span>
          </Link>
          {review.rating !== null ? (
            <span className="flex items-center gap-1">
              <Stars rating={review.rating} />
              <span className="sr-only">
                {t("rating.outOfFive", { stars: format.number(ratingToStars(review.rating)) })}
              </span>
            </span>
          ) : release.ratingsHidden ? (
            <span className="text-xs text-fg-muted italic">{t("review.ratingHidden")}</span>
          ) : (
            <span className="text-xs text-fg-muted italic">{t("review.noRating")}</span>
          )}
          <time dateTime={review.createdAt} className="font-mono text-xs text-fg-muted">
            {format.dateTime(new Date(review.createdAt), { dateStyle: "long" })}
          </time>
        </div>

        <p lang={review.lang} className="text-lg leading-relaxed whitespace-pre-line text-pretty">
          {review.body}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
          {detail.canLike ? (
            <LikeButton subject={subject} liked={detail.viewerLiked} count={review.likeCount} />
          ) : (
            <span className="flex items-center gap-1">
              <HeartIcon /> {t("review.likes", { count: review.likeCount })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CommentIcon /> {t("review.comments", { count: review.commentCount })}
          </span>
          {detail.isOwner && (
            <Link href={`/review/${id}/edit`} className={linkClasses}>
              {t("review.edit")}
            </Link>
          )}
          {signedIn && !detail.isOwner && (
            <ReportButton subject={{ kind: "review", id }} className="ml-auto" />
          )}
        </div>
      </article>

      <section aria-labelledby="comments" className="space-y-6">
        <h2 id="comments" className="font-serif text-2xl">
          {t("comments.title")}
        </h2>
        {comments.items.length === 0 && !cursor ? (
          <p className="font-serif text-lg text-fg-muted italic">{t("comments.empty")}</p>
        ) : (
          <ul className="space-y-5">
            {comments.items.map((comment) => (
              <li key={comment.id}>
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
          <CommentForm subject={subject} />
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
