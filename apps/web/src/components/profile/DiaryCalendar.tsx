import type { DiaryEntry } from "@spleen/api";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";
import { monthGrid } from "@/lib/calendar";
import { cn } from "@/lib/cn";

/** Dates are calendar days: format them at noon UTC so no time zone shifts them. */
const noon = (day: string) => new Date(`${day}T12:00:00Z`);

/** Diary, calendar view: one month, a cover per day (the first listen) and a count. */
export function DiaryCalendar({
  month,
  entries,
  previousHref,
  nextHref,
}: {
  month: string;
  entries: DiaryEntry[];
  previousHref: string;
  nextHref: string | null;
}) {
  const t = useTranslations("diary");
  const format = useFormatter();
  const locale = useLocale();
  const weekStartsOn = locale === "en" ? 0 : 1;
  const cells = monthGrid(month, weekStartsOn);
  const byDay = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    byDay.set(entry.listenedOn, [...(byDay.get(entry.listenedOn) ?? []), entry]);
  }
  // 2023-01-01 was a Sunday.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    noon(`2023-01-0${1 + ((i + weekStartsOn) % 7)}`),
  );
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const monthLabel = format.dateTime(noon(`${month}-01`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const linkClasses = "text-sm text-link underline-offset-2 hover:underline";

  return (
    <div className="space-y-4">
      <nav aria-label={t("monthNav")} className="flex items-center justify-between gap-4">
        <Link href={previousHref} scroll={false} className={linkClasses}>
          ← {t("previousMonth")}
        </Link>
        <h2 className="font-serif text-2xl first-letter:uppercase">{monthLabel}</h2>
        {nextHref ? (
          <Link href={nextHref} scroll={false} className={linkClasses}>
            {t("nextMonth")} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{t("calendarCaption", { month: monthLabel })}</caption>
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th
                key={day.toISOString()}
                scope="col"
                className="pb-2 font-mono text-[0.65rem] font-normal tracking-widest text-fg-muted uppercase"
              >
                <abbr
                  title={format.dateTime(day, { weekday: "long", timeZone: "UTC" })}
                  className="no-underline"
                >
                  {format.dateTime(day, { weekday: "short", timeZone: "UTC" })}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => {
                if (!day) return <td key={`empty-${d}`} className="p-0.5" />;
                const dayEntries = byDay.get(day) ?? [];
                const first = dayEntries[0];
                const dateLabel = format.dateTime(noon(day), {
                  dateStyle: "long",
                  timeZone: "UTC",
                });
                return (
                  <td key={day} className="p-0.5 align-top">
                    <div
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-sm border",
                        first ? "border-transparent" : "border-border/50 bg-surface/30",
                      )}
                    >
                      {first ? (
                        <Link
                          href={`/album/${first.release.slug}`}
                          className="group block h-full focus-visible:outline-offset-2"
                        >
                          <Cover
                            slug={first.release.slug}
                            title={first.release.title}
                            coverUrl={first.release.coverUrl}
                            showText={false}
                            sizes="(min-width: 640px) 96px, 14vw"
                            className="h-full rounded-none shadow-none transition-opacity group-hover:opacity-80"
                          />
                          <span className="sr-only">
                            {t("dayListens", {
                              date: dateLabel,
                              count: dayEntries.length,
                              titles: dayEntries
                                .map((e) => e.track?.title ?? e.release.title)
                                .join(", "),
                            })}
                          </span>
                        </Link>
                      ) : (
                        <span className="sr-only">{dateLabel}</span>
                      )}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute top-0.5 left-1 font-mono text-[0.65rem]",
                          first ? "rounded-sm bg-bg/75 px-0.5 text-fg" : "text-fg-muted",
                        )}
                      >
                        {Number(day.slice(8, 10))}
                      </span>
                      {dayEntries.length > 1 && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-0.5 bottom-0.5 rounded-sm bg-bg/80 px-1 font-mono text-[0.65rem] text-star"
                        >
                          +{dayEntries.length - 1}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && (
        <p className="font-serif text-lg text-fg-muted italic">{t("monthEmpty")}</p>
      )}
    </div>
  );
}
