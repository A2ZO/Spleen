import type { ReleaseCard, TopRatedItem, TrendItem } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { ReleaseTile } from "@/components/release/ReleaseTile";
import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/* Discovery blocks shared by the home page and /discover. */

const grid = "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6";

/** Weekly trends: ranked tiles with how many members listened; says when it was completed. */
export function TrendsGrid({ items, className }: { items: TrendItem[]; className?: string }) {
  const t = useTranslations("discover");
  const filled = items.some((i) => i.source === "month")
    ? "filledMonth"
    : items.some((i) => i.source === "all")
      ? "filledAll"
      : null;
  return (
    <div className={className}>
      {filled && <p className="mb-5 text-sm text-fg-muted italic">{t(filled)}</p>}
      <ol className={grid}>
        {items.map((item, index) => (
          <li key={item.release.id}>
            <ReleaseTile release={item.release} rank={index + 1} />
            <p className="mt-1 font-mono text-xs text-fg-muted">
              {t("listeners", { count: item.listeners })}
              {item.source !== "lang" && (
                <span className="ml-1.5 text-fg-muted/80">
                  · {t(item.source === "all" ? "sourceAll" : "sourceMonth")}
                </span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ReleaseGrid({
  releases,
  className,
}: {
  releases: ReleaseCard[];
  className?: string;
}) {
  return (
    <ul className={cn(grid, className)}>
      {releases.map((release) => (
        <li key={release.id}>
          <ReleaseTile release={release} />
        </li>
      ))}
    </ul>
  );
}

/** A top rated chart: rank, cover, title, Bayesian score and number of ratings. */
export function TopRatedList({ items }: { items: TopRatedItem[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const stars = (rating: number) =>
    format.number(ratingToStars(rating), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <ol className="divide-y divide-border/50 border-y border-border/50">
      {items.map(({ rank, release, score }) => (
        <li key={release.id} className="relative flex items-center gap-3 py-3 sm:gap-4">
          <span className="w-8 shrink-0 text-right font-mono text-sm text-star">
            <span className="sr-only">{t("list.rank", { rank })}</span>
            <span aria-hidden="true">{rank}</span>
          </span>
          <div className="size-14 shrink-0 sm:size-16">
            <Cover
              slug={release.slug}
              title={release.title}
              coverUrl={release.coverUrl}
              showText={false}
              sizes="64px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg leading-tight">
              <Link
                href={`/album/${release.slug}`}
                className="after:absolute after:inset-0 hover:text-star focus-visible:outline-none"
              >
                {release.title}
              </Link>
            </p>
            <p className="truncate text-sm text-fg-muted">
              {[release.artists.map((a) => a.name).join(", "), release.year]
                .filter((part) => part !== null && part !== "")
                .join(" · ")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {score === null ? (
              <p className="max-w-28 text-xs text-fg-muted italic">{t("discover.scoreHidden")}</p>
            ) : (
              <>
                <p className="font-mono text-lg text-star">
                  <span className="sr-only">{t("discover.score", { score: stars(score) })}</span>
                  <span aria-hidden="true">{stars(score)}</span>
                </p>
                <p className="font-mono text-xs text-fg-muted">
                  {t("discover.ratingCount", { count: release.ratingCount })}
                </p>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
