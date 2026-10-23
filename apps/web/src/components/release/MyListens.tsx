"use client";

import type { MoodRef, MyEntry } from "@spleen/api";
import { ratingToStars } from "@spleen/validators";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { HeartIcon, RepeatIcon } from "@/components/ui/icons";
import { Stars } from "@/components/ui/Stars";

/** The member's own listens of the item, each one editable. */
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
    <div className="mt-5 border-t border-border/60 pt-4">
      <h3 className="font-mono text-xs tracking-[0.2em] text-fg-muted uppercase">
        {t("listening.myListens")}
      </h3>
      <ul className="mt-2 divide-y divide-border/50">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
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
              className="text-xs text-link underline-offset-2 hover:underline"
            >
              {t("listening.edit")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
