import { cursorSchema, listUpdateSchema } from "@spleen/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { cache } from "react";

import { ListItemRow } from "@/components/lists/ListItemRow";
import { CommentForm, CommentItem } from "@/components/social/Comments";
import { LikeButton } from "@/components/social/LikeButton";
import { ReportButton } from "@/components/social/ReportDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { CommentIcon, HeartIcon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { initRouteLocale } from "@/i18n/locale";
import { Link, redirect } from "@/i18n/navigation";
import { loadCursorPage } from "@/lib/api-errors";
import { firstParam, hrefWith, pageParam, type SearchParams } from "@/lib/search-params";
import { getApi } from "@/server/api";

type Props = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<SearchParams>;
};

const getList = cache(async (id: string, page: number) => {
  if (!listUpdateSchema.shape.id.safeParse(id).success) return null;
  return (await getApi()).list.byId({ id, page });
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const list = await getList(id, pageParam((await searchParams).page));
  if (!list) return {};
  const t = await getTranslations("list");
  return {
    title: t("pageTitle", { title: list.title, name: list.owner.displayName }),
    description: list.description || undefined,
  };
}

const linkClasses = "text-link underline-offset-2 hover:underline";

/** A list: its items (50 per page), likes and comments. Stable URL `/list/[id]`. */
export default async function ListPage({ params, searchParams }: Props) {
  const { locale: rawLocale, id } = await params;
  const locale = initRouteLocale(rawLocale);
  const raw = await searchParams;
  const page = pageParam(raw.page);
  const list = await getList(id, page);
  if (!list) notFound();
  const path = `/list/${id}`;
  if (list.items.page > list.items.pageCount) {
    redirect({ href: hrefWith(path, { page: list.items.pageCount }), locale });
  }
  const api = await getApi();
  const me = await api.account.me();
  const subject = { kind: "list" as const, id };
  const parsedCursor = cursorSchema.safeParse(firstParam(raw.after));
  const { page: comments, cursor } = await loadCursorPage(
    parsedCursor.success ? parsedCursor.data : undefined,
    (c) => api.comment.list({ subject, cursor: c }),
  );
  const t = await getTranslations();
  const format = await getFormatter();
  const signedIn = Boolean(me?.profile);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <article className="space-y-8">
        <header className="space-y-4">
          <p className="flex flex-wrap items-center gap-2 font-mono text-xs tracking-[0.2em] text-star uppercase">
            <span>{t("list.itemCount", { count: list.items.total })}</span>
            {list.ranked && <Badge>{t("list.ranked")}</Badge>}
          </p>
          <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{list.title}</h1>
          {list.description && (
            <p className="max-w-2xl text-lg whitespace-pre-line text-fg-muted text-pretty">
              {list.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link
              href={`/u/${list.owner.username}`}
              className="flex items-center gap-2 text-fg-muted hover:text-fg"
            >
              <Avatar
                name={list.owner.displayName}
                seed={list.owner.username}
                src={list.owner.avatarUrl}
                className="size-8 text-xs"
              />
              <span>{t("list.byline", { name: list.owner.displayName })}</span>
            </Link>
            <time dateTime={list.updatedAt} className="font-mono text-xs text-fg-muted">
              {t("list.updated", {
                date: format.dateTime(new Date(list.updatedAt), { dateStyle: "long" }),
              })}
            </time>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
            {list.canLike ? (
              <LikeButton subject={subject} liked={list.viewerLiked} count={list.likeCount} />
            ) : (
              <span className="flex items-center gap-1">
                <HeartIcon /> {t("review.likes", { count: list.likeCount })}
              </span>
            )}
            <a href="#comments" className="flex items-center gap-1 hover:text-fg">
              <CommentIcon /> {t("review.comments", { count: list.commentCount })}
            </a>
            {list.isOwner && (
              <ButtonLink href={`${path}/edit`} variant="outline" className="ml-auto">
                {t("list.edit")}
              </ButtonLink>
            )}
            {signedIn && !list.isOwner && <ReportButton subject={subject} className="ml-auto" />}
          </div>
        </header>

        <section aria-labelledby="items">
          <h2 id="items" className="sr-only">
            {t("list.itemsTitle")}
          </h2>
          {list.items.total === 0 ? (
            <p className="font-serif text-lg text-fg-muted italic">
              {list.isOwner ? t("list.emptyOwnList") : t("list.empty")}
            </p>
          ) : (
            <ol className="divide-y divide-border/50 border-y border-border/50">
              {list.items.items.map((item) => (
                <li key={item.id}>
                  <ListItemRow item={item} ranked={list.ranked} />
                </li>
              ))}
            </ol>
          )}
          <Pagination
            page={list.items.page}
            pageCount={list.items.pageCount}
            hrefFor={(n) => hrefWith(path, { page: n })}
            className="mt-6"
          />
        </section>
      </article>

      <section aria-labelledby="comments" className="scroll-mt-24 space-y-6">
        <SectionHeading id="comments">{t("list.comments")}</SectionHeading>
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
        {list.canComment ? (
          <CommentForm subject={subject} />
        ) : signedIn ? (
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
