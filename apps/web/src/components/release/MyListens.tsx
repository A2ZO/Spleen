"use client";

import type { MoodRef, MyEntry } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { HeartIcon, RepeatIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/Stars";

/** The member's own listens of the item, each one editable (in `MyListensCard`). */
export function MyListens({
  entries,
  moods,
  onEdit,
}: {
  entries: MyEntry[];
  moods: MoodRef[];
  onEdit: (entry: MyEntry) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  if (entries.length === 0) return null;
  const moodLabel = (id: string) => {
    const mood = moods.find((m) => m.id === id);
    return mood ? (locale === "en" ? mood.labelEn : mood.labelFr) : null;
  };

  return (
    // In a narrow card (half width on phones) the date takes its own line above the rest.
    <ul className="@container divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-x-3 py-1.5 text-sm">
          <div className="min-w-0 flex-1 basis-full pt-1 @[16rem]:basis-0 @[16rem]:pt-0">
            <p className="truncate">
              {entry.listenedOn
                ? format.dateTime(new Date(`${entry.listenedOn}T12:00:00Z`), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })
                : t("listening.quickListen")}
            </p>
            {entry.moodIds.length > 0 && (
              <p className="truncate text-xs text-fg-muted">
                {entry.moodIds.map(moodLabel).filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {entry.rating !== null && (
            <span>
              <Stars rating={entry.rating} className="text-xs" />
              <span className="sr-only">
                {t("rating.outOfFive", { stars: format.number(ratingToStars(entry.rating)) })}
              </span>
            </span>
          )}
          {entry.liked && (
            <HeartIcon
              filled
              className="text-star"
              role="img"
              aria-hidden={false}
              aria-label={t("profile.liked")}
            />
          )}
          {entry.relisten && (
            <RepeatIcon role="img" aria-hidden={false} aria-label={t("profile.relisten")} />
          )}
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="min-h-11 px-1 text-sm text-link underline-offset-4 hover:underline"
          >
            {t("listening.edit")}
          </button>
        </li>
      ))}
    </ul>
  );
}
