import type { BaseStats, ListenedCounts } from "@spleen/api";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { RatingHistogram } from "@/components/ui/RatingHistogram";

function StatBlock({
  title,
  note,
  children,
}: {
  title: string;
  /** How the block counts, e.g. "in listens, relistens included". */
  note?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <h3 className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">{title}</h3>
      {note && <p className="mt-1 text-xs text-fg-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Counts({ counts }: { counts: ListenedCounts }) {
  const t = useTranslations("stats");
  const rows = [
    ["albums", counts.album],
    ["eps", counts.ep],
    ["singles", counts.single],
    ["tracks", counts.track],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4">
      {rows.map(([key, count]) => (
        <div key={key} className="flex flex-col-reverse">
          <dt className="mt-1 text-sm text-fg-muted">{t(key, { count })}</dt>
          <dd className="font-mono text-3xl leading-none text-star tabular">{count}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled horizontal bar list (top artists, genres, decades). */
function BarList({ items }: { items: { key: string; label: ReactNode; count: number }[] }) {
  const t = useTranslations("stats");
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ol className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate">{item.label}</span>
            <span className="font-mono text-xs text-fg-muted">
              {t("listens", { count: item.count })}
            </span>
          </div>
          <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-star/80"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Free-tier stats; Spleen+ blocks will be a separate panel fed by `MemberStats.plus`. */
export function StatsPanel({ stats }: { stats: BaseStats }) {
  const t = useTranslations("stats");
  const format = useFormatter();
  const maxMonth = Math.max(1, ...stats.activityByMonth);
  // Years are labels, not quantities: pass them as strings so ICU doesn't group digits.
  const year = String(stats.year);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <StatBlock title={t("thisYear", { year })}>
        <Counts counts={stats.listenedThisYear} />
      </StatBlock>
      <StatBlock title={t("total")} note={t("totalNote")}>
        <Counts counts={stats.listenedTotal} />
      </StatBlock>
      <StatBlock title={t("ratings")} note={t("ratingsNote")}>
        <RatingHistogram distribution={stats.ratingDistribution} label={t("ratings")} />
      </StatBlock>
      <StatBlock title={t("activity", { year })} note={t("inListens")}>
        <ol className="flex h-24 items-end gap-1">
          {stats.activityByMonth.map((count, month) => {
            const label = format.dateTime(new Date(Date.UTC(stats.year, month, 15)), {
              month: "short",
            });
            return (
              <li
                key={month}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="sr-only">
                  {label} : {t("listens", { count })}
                </span>
                <div
                  aria-hidden="true"
                  className="w-full rounded-t-[1px] bg-star/80"
                  style={{ height: `${Math.max(3, (count / maxMonth) * 100)}%` }}
                />
                <span
                  aria-hidden="true"
                  className="font-mono text-[0.6rem] text-fg-muted uppercase"
                >
                  {label.slice(0, 1)}
                </span>
              </li>
            );
          })}
        </ol>
      </StatBlock>
      <StatBlock title={t("topArtists", { year })} note={t("inListens")}>
        <BarList
          items={stats.topArtists.map((a) => ({ key: a.slug, label: a.name, count: a.count }))}
        />
      </StatBlock>
      <StatBlock title={t("topGenres", { year })} note={t("inListens")}>
        <BarList
          items={stats.topGenres.map((g) => ({ key: g.name, label: g.name, count: g.count }))}
        />
      </StatBlock>
      <StatBlock title={t("decades")} note={t("decadesNote")}>
        <BarList
          items={stats.decades.map((d) => ({
            key: String(d.decade),
            label: t("decade", { decade: String(d.decade) }),
            count: d.count,
          }))}
        />
      </StatBlock>
    </div>
  );
}
