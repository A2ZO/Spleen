import type { ListItem } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { Stars } from "@/components/ui/Stars";
import { Link } from "@/i18n/navigation";

/** Title, link and subtitle of any list item (release, track or artist). */
export function listItemView(item: ListItem) {
  switch (item.kind) {
    case "release":
      return {
        title: item.release.title,
        href: `/album/${item.release.slug}`,
        subtitle: [item.release.artists.map((a) => a.name).join(", "), item.release.year]
          .filter((part) => part !== null && part !== "")
          .join(" · "),
      };
    case "track":
      return {
        title: item.track.title,
        href: `/track/${item.track.slug}`,
        subtitle: [item.track.artists.map((a) => a.name).join(", "), item.track.release?.title]
          .filter(Boolean)
          .join(" · "),
      };
    case "artist":
      return {
        title: item.artist.name,
        href: `/artist/${item.artist.slug}`,
        subtitle: item.artist.disambiguation ?? "",
      };
  }
}

function Thumb({ item }: { item: ListItem }) {
  if (item.kind === "artist") {
    return (
      <Avatar
        name={item.artist.name}
        seed={item.artist.slug}
        src={item.artist.imageUrl}
        className="size-full text-base"
      />
    );
  }
  const release = item.kind === "release" ? item.release : item.track.release;
  if (!release) return <div className="size-full rounded-thumb bg-surface" />;
  return (
    <Cover
      slug={release.slug}
      title={release.title}
      coverUrl={release.coverUrl}
      showText={false}
      sizes="64px"
    />
  );
}

/** One row of a list: rank (ranked lists), cover, title, kind and community rating. */
export function ListItemRow({
  item,
  ranked,
  actions,
}: {
  item: ListItem;
  ranked: boolean;
  /** Owner controls (move, remove) shown at the end of the row. */
  actions?: ReactNode;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const view = listItemView(item);
  const rating = item.kind === "release" ? item.release.averageRating : null;

  return (
    <div className="relative flex items-center gap-3 px-3 py-3 sm:gap-4">
      {ranked && (
        <span className="w-8 shrink-0 text-right font-display text-xl font-extrabold text-star tabular">
          <span className="sr-only">{t("list.rank", { rank: item.position })}</span>
          <span aria-hidden="true">{item.position}</span>
        </span>
      )}
      <div className="size-14 shrink-0 sm:size-16">
        <Thumb item={item} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold tracking-[-0.02em] break-words max-sm:line-clamp-2 sm:truncate">
          <Link
            href={view.href}
            className="hover:text-star focus-visible:outline-none after:absolute after:inset-0"
          >
            {view.title}
          </Link>
        </p>
        {view.subtitle && (
          <p className="text-sm break-words text-fg-muted max-sm:line-clamp-2 sm:truncate">
            {view.subtitle}
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <Badge>{t(`list.kind.${item.kind}`)}</Badge>
          {rating !== null && (
            <span className="flex items-center gap-1">
              <Stars rating={rating} />
              <span className="sr-only">
                {t("rating.outOfFive", {
                  stars: format.number(ratingToStars(rating), { maximumFractionDigits: 1 }),
                })}
              </span>
            </span>
          )}
        </p>
      </div>
      {actions && <div className="relative z-10 flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
