import type { UpcomingItem } from "@spleen/api";
import { useFormatter, useTranslations } from "next-intl";

import { ArtistLinks } from "@/components/catalog/ArtistLinks";
import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";
import { formatUpcomingDate } from "@/lib/release-date";

import { WantToListenButton } from "./WantToListenButton";

/**
 * One upcoming release: cover, title and artists (each its own link, so the row is not one
 * whole link), date, « Date modifiée » and the « À écouter » button.
 */
export function UpcomingRow({ item }: { item: UpcomingItem }) {
  const t = useTranslations();
  const format = useFormatter();
  const { release } = item;
  return (
    <div className="flex items-center gap-3 py-3 sm:gap-4">
      <Link href={`/album/${release.slug}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <span className="block size-14 sm:size-16">
          <Cover
            slug={release.slug}
            title={release.title}
            coverUrl={release.coverUrl}
            showText={false}
            sizes="64px"
          />
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-7 font-bold tracking-[-0.02em] break-words max-sm:line-clamp-2 sm:truncate">
          <Link href={`/album/${release.slug}`} className="hover:text-star">
            {release.title}
          </Link>
        </p>
        <p className="text-sm leading-6 break-words text-fg-muted max-sm:line-clamp-2 sm:truncate">
          <ArtistLinks artists={release.artists} />
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <span className="font-medium text-fg">
            {formatUpcomingDate(format, item.date, item.precision)}
          </span>
          <span>{t(`releaseType.${release.type}`)}</span>
          {item.dateChanged && <Badge>{t("upcoming.dateChanged")}</Badge>}
        </p>
      </div>
      <WantToListenButton
        releaseId={release.id}
        title={release.title}
        wantToListen={item.wantToListen}
      />
    </div>
  );
}
