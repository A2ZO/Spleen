import type { ReleaseCard } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Cover } from "@/components/ui/Cover";
import { Stars } from "@/components/ui/Stars";
import { Link } from "@/i18n/navigation";

/** Cover + title + artist + community average, as used in grids. */
export function ReleaseTile({ release, rank }: { release: ReleaseCard; rank?: number }) {
  const t = useTranslations();
  const format = useFormatter();
  const artistNames = release.artists.map((a) => a.name).join(", ");

  return (
    <article className="group relative">
      <Cover
        slug={release.slug}
        title={release.title}
        artistName={release.artists[0]?.name}
        coverUrl={release.coverUrl}
        className="transition-transform duration-300 ease-spleen group-hover:-translate-y-1"
      />
      {rank !== undefined && (
        <span
          aria-hidden="true"
          className="absolute -top-2 -left-2 z-10 flex size-7 items-center justify-center rounded-full bg-bg font-mono text-xs text-star ring-1 ring-border"
        >
          {rank}
        </span>
      )}
      <h3 className="mt-3 font-serif text-base leading-tight">
        <Link
          href={`/album/${release.slug}`}
          className="after:absolute after:inset-0 hover:text-star focus-visible:outline-none"
        >
          {release.title}
        </Link>
      </h3>
      <p className="mt-0.5 truncate text-sm text-fg-muted">
        {artistNames} · {release.year}
      </p>
      {release.averageRating !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          <Stars rating={release.averageRating} />
          <span className="font-mono text-xs text-fg-muted">
            <span className="sr-only">
              {t("rating.outOfFive", {
                stars: format.number(ratingToStars(release.averageRating), {
                  maximumFractionDigits: 1,
                }),
              })}
            </span>
            <span aria-hidden="true">
              {format.number(ratingToStars(release.averageRating), {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
          </span>
        </p>
      )}
    </article>
  );
}
