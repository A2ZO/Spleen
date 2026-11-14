import type { ReleaseCard } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";

/** Cover + title + artist + community average, as used in grids. */
export function ReleaseTile({ release, rank }: { release: ReleaseCard; rank?: number }) {
  const t = useTranslations();
  const format = useFormatter();
  const artistNames = release.artists.map((a) => a.name).join(", ");

  return (
    <article className="group relative">
      <div className="relative transition-transform duration-150 ease-spleen motion-safe:group-hover:-translate-y-1">
        <Cover
          slug={release.slug}
          title={release.title}
          artistName={release.artists[0]?.name}
          coverUrl={release.coverUrl}
          className="rounded-cover"
        />
        {rank !== undefined && (
          <span
            aria-hidden="true"
            className="absolute top-2.5 left-2.5 z-10 flex size-7 items-center justify-center rounded-full bg-bg font-display text-sm font-bold text-fg"
          >
            {rank}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-base leading-tight font-bold">
        <Link
          href={`/album/${release.slug}`}
          className="after:absolute after:inset-0 hover:text-star focus-visible:outline-none"
        >
          {release.title}
        </Link>
      </h3>
      <p className="mt-0.5 truncate text-sm text-fg-muted">
        {[artistNames, release.year].filter((part) => part !== null && part !== "").join(" · ")}
      </p>
      {release.averageRating !== null && (
        <p className="mt-1 font-mono text-xs text-star">
          <span className="sr-only">
            {t("rating.outOfFive", {
              stars: format.number(ratingToStars(release.averageRating), {
                maximumFractionDigits: 1,
              }),
            })}
          </span>
          <span aria-hidden="true">
            ★{" "}
            {format.number(ratingToStars(release.averageRating), {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
        </p>
      )}
    </article>
  );
}
