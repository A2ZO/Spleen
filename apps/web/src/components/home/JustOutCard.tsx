import type { ReleaseCard } from "@spleen/api";
import { useFormatter, useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";

/**
 * The small card of the home page. By default « Vient de sortir »: the newest release of
 * `discovery.recent` (already read by the home page, out in the last 90 days). For a member
 * with a followed release due within 6 days (`upcoming.home`, issue #32), « Sort demain » /
 * « Sort vendredi » with that release and a link to their upcoming releases. Only links: no
 * listen or rating action on a record not out yet.
 */
export function JustOutCard({
  release,
  soon,
}: {
  release: ReleaseCard;
  /** The day release is due (`YYYY-MM-DD`) in `inDays` days, in the member's zone. */
  soon?: { date: string; inDays: number };
}) {
  const t = useTranslations();
  const format = useFormatter();
  const artists = release.artists.map((a) => a.name).join(", ");
  const label = !soon
    ? t("home.justOut")
    : soon.inDays === 1
      ? t("home.outTomorrow")
      : t("home.outOn", {
          weekday: format.dateTime(new Date(`${soon.date}T12:00:00Z`), {
            weekday: "long",
            timeZone: "UTC",
          }),
        });
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
        <h2 className="font-mono text-xs tracking-[0.14em] text-star uppercase">{label}</h2>
        <p className="mt-1 leading-tight font-semibold">
          <Link href={`/album/${release.slug}`} className="hover:text-star">
            {release.title}
          </Link>
          {artists && <span className="text-fg-muted"> · {artists}</span>}
        </p>
        <Link
          href={soon ? "/upcoming" : "/discover#recent"}
          className="mt-1 inline-block text-sm text-link underline-offset-2 hover:underline"
        >
          {soon ? t("home.soonAll") : t("discover.recentTitle")}
        </Link>
      </div>
    </Card>
  );
}
