import type { ReleaseCard } from "@spleen/api";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";

/**
 * "Just out": the newest release of `discovery.recent` (already read by the home page, out
 * in the last 90 days, never a future date). Until upcoming releases exist (milestone 11).
 * A `ReleaseCard` only carries the year: no day is shown.
 */
export function JustOutCard({ release }: { release: ReleaseCard }) {
  const t = useTranslations();
  const artists = release.artists.map((a) => a.name).join(", ");
  return (
    <Card className="flex items-center gap-4 md:p-5">
      <div className="w-16 shrink-0">
        <Cover
          slug={release.slug}
          title={release.title}
          coverUrl={release.coverUrl}
          showText={false}
          sizes="64px"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-mono text-xs tracking-[0.14em] text-star uppercase">
          {t("home.justOut")}
        </h2>
        <p className="mt-1 leading-tight font-semibold">
          <Link href={`/album/${release.slug}`} className="hover:text-star">
            {release.title}
          </Link>
          {artists && <span className="text-fg-muted"> · {artists}</span>}
        </p>
        <Link
          href="/discover#recent"
          className="mt-1 inline-block text-sm text-link underline-offset-2 hover:underline"
        >
          {t("discover.recentTitle")}
        </Link>
      </div>
    </Card>
  );
}
