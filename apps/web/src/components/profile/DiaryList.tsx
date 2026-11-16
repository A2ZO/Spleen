import type { DiaryEntry } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { HeartIcon, PenIcon, RepeatIcon } from "@/components/ui/icons";
import { UndoableGate } from "@/components/ui/UndoableGate";
import { Link } from "@/i18n/navigation";

/** Diary, list view, grouped by month (the calendar view is `DiaryCalendar`). */
export function DiaryList({ entries }: { entries: DiaryEntry[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();

  const months = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const key = entry.listenedOn.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), entry]);
  }

  return (
    <div className="space-y-8">
      {[...months.entries()].map(([month, monthEntries]) => (
        <section key={month} aria-labelledby={`diary-${month}`}>
          <h3
            id={`diary-${month}`}
            className="mb-3 font-mono text-xs tracking-[0.14em] text-fg-muted uppercase"
          >
            {format.dateTime(new Date(`${month}-01T12:00:00Z`), { month: "long", year: "numeric" })}
          </h3>
          <ul className="space-y-2">
            {monthEntries.map((entry) => (
              // Hidden while deleted with "Undo" (the same session may still show it here).
              <UndoableGate key={entry.id} id={entry.id}>
                <li className="flex items-center gap-3 rounded-card-sm bg-surface px-3 py-2.5 sm:gap-4 sm:px-4">
                  <time
                    dateTime={entry.listenedOn}
                    className="w-8 shrink-0 text-center font-display text-2xl font-extrabold tabular"
                  >
                    <span aria-hidden="true">{Number(entry.listenedOn.slice(8, 10))}</span>
                    <span className="sr-only">
                      {t("profile.listenedOn", {
                        date: format.dateTime(new Date(`${entry.listenedOn}T12:00:00Z`), {
                          dateStyle: "long",
                        }),
                      })}
                    </span>
                  </time>
                  <Cover
                    slug={entry.release.slug}
                    title={entry.release.title}
                    coverUrl={entry.release.coverUrl}
                    className="w-11 shrink-0 rounded-thumb"
                    showText={false}
                    sizes="44px"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={
                        entry.track ? `/track/${entry.track.slug}` : `/album/${entry.release.slug}`
                      }
                      className="block truncate font-display text-base leading-tight font-bold hover:text-star sm:text-lg"
                    >
                      {entry.track?.title ?? entry.release.title}
                    </Link>
                    <p className="truncate text-sm text-fg-muted">
                      {[
                        entry.release.artists.map((a) => a.name).join(", "),
                        entry.track ? entry.release.title : entry.release.year,
                      ]
                        .filter((part) => part !== null && part !== "")
                        .join(" · ")}
                      {entry.format && (
                        <span className="sm:hidden"> · {t(`format.${entry.format}`)}</span>
                      )}
                    </p>
                    {entry.moods.length > 0 && (
                      <p className="truncate text-xs text-fg-muted">
                        <span className="sr-only">{t("profile.moods")} : </span>
                        {entry.moods
                          .map((m) => (locale === "en" ? m.labelEn : m.labelFr))
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                    {entry.rating !== null && (
                      <span className="font-mono text-sm whitespace-nowrap text-star">
                        <span aria-hidden="true">
                          ★{" "}
                          {format.number(ratingToStars(entry.rating), {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                        <span className="sr-only">
                          {t("rating.outOfFive", {
                            stars: format.number(ratingToStars(entry.rating)),
                          })}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-2 text-fg-muted">
                      {entry.liked && (
                        <HeartIcon
                          filled
                          className="text-star"
                          aria-label={t("profile.liked")}
                          aria-hidden={false}
                          role="img"
                        />
                      )}
                      {entry.relisten && (
                        <RepeatIcon
                          aria-label={t("profile.relisten")}
                          aria-hidden={false}
                          role="img"
                        />
                      )}
                      {entry.hasReview && (
                        <PenIcon
                          aria-label={t("profile.reviewed")}
                          aria-hidden={false}
                          role="img"
                        />
                      )}
                      {entry.format && (
                        <span className="hidden sm:inline">
                          <Badge>{t(`format.${entry.format}`)}</Badge>
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              </UndoableGate>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
