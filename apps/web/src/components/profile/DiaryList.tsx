import type { DiaryEntry } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Cover } from "@/components/ui/Cover";
import { HeartIcon, RepeatIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/Stars";
import { Link } from "@/i18n/navigation";

/** Diary, list view, grouped by month (the calendar view comes with milestone 6). */
export function DiaryList({ entries }: { entries: DiaryEntry[] }) {
  const t = useTranslations();
  const format = useFormatter();

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
            className="mb-2 font-mono text-xs tracking-[0.2em] text-star uppercase"
          >
            {format.dateTime(new Date(`${month}-01T12:00:00Z`), { month: "long", year: "numeric" })}
          </h3>
          <ul className="divide-y divide-border/50">
            {monthEntries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-3 sm:gap-4">
                <time
                  dateTime={entry.listenedOn}
                  className="w-8 shrink-0 text-center font-mono text-xl text-fg-muted tabular"
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
                  className="w-11 shrink-0"
                  showText={false}
                  sizes="44px"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/album/${entry.release.slug}`}
                    className="block truncate font-serif text-lg leading-tight hover:text-star"
                  >
                    {entry.release.title}
                  </Link>
                  <p className="truncate text-sm text-fg-muted">
                    {[entry.release.artists.map((a) => a.name).join(", "), entry.release.year]
                      .filter((part) => part !== null && part !== "")
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                  {entry.rating !== null && (
                    <span>
                      <Stars rating={entry.rating} className="text-sm" />
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
                    <Badge className="hidden sm:inline-flex">{t(`format.${entry.format}`)}</Badge>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
