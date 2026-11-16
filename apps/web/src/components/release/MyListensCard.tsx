"use client";

import type { MoodRef, MyItemState } from "@spleen/api";
import type { ListenTargetInput } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { Card } from "@/components/ui/Card";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { useUndoHidden } from "@/lib/use-undoable-delete";

import type { LogTrack } from "./LogDialog";
import { MyListens } from "./MyListens";
import { useListen, useLogEditor } from "./use-listen";

/**
 * "Your listens" card (members): how many times, the last and first dated listens, a link to
 * the diary, and the editable list folded in a `<details>`. Shares the live state of the
 * "Your rating" card (`useListen`), so a click there shows here at once.
 */
export function MyListensCard({
  target,
  title,
  initial,
  moods,
  tracks,
  username,
  className,
}: {
  target: ListenTargetInput;
  title: string;
  initial: MyItemState;
  moods: MoodRef[];
  tracks: LogTrack[];
  /** Null until onboarding is done (no diary yet). */
  username: string | null;
  className?: string;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const listen = useListen(target, initial);
  const log = useLogEditor({ target, title, moods, tracks, listen });
  const hidden = useUndoHidden();
  const entries = listen.shown.entries.filter((entry) => !hidden(entry.id));
  const dated = entries
    .filter((entry) => entry.listenedOn !== null)
    .sort((a, b) => (b.listenedOn ?? "").localeCompare(a.listenedOn ?? ""));
  const last = dated[0];
  const first = dated.at(-1);
  const day = (isoDay: string) =>
    format.dateTime(new Date(`${isoDay}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <Card
      role="region"
      aria-labelledby="my-listens-title"
      className={`flex flex-col gap-3 ${className ?? ""}`}
    >
      <h2
        id="my-listens-title"
        className="font-mono text-xs font-normal tracking-[0.06em] text-fg-muted uppercase"
      >
        {t("listening.myListens")}
      </h2>
      {entries.length === 0 ? (
        <p className="text-fg-muted">{t("detail.noListens")}</p>
      ) : (
        <>
          <p className="font-display text-4xl leading-none font-extrabold tracking-[-0.03em] md:text-[52px]">
            {t("detail.myListensCount", { count: entries.length })}
          </p>
          <p className="text-[15px] leading-relaxed text-fg-muted">
            {last
              ? last.format
                ? t("detail.lastListenFormat", {
                    date: day(last.listenedOn!),
                    format: t(`format.${last.format}`),
                  })
                : t("detail.lastListen", { date: day(last.listenedOn!) })
              : t("detail.undatedOnly")}
            {first && first !== last && (
              <> {t("detail.firstListen", { date: day(first.listenedOn!) })}</>
            )}
          </p>
        </>
      )}
      {username && dated.length > 0 && (
        <Link
          href={`/u/${username}/diary`}
          className="mt-auto font-medium text-link underline underline-offset-4"
        >
          {t("detail.seeDiary")}
        </Link>
      )}
      {entries.length > 0 && (
        <details className="group border-t border-border pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {t("detail.editListens")}
            <ChevronDownIcon className="text-base group-open:rotate-180" />
          </summary>
          <MyListens entries={entries} moods={moods} onEdit={(entry) => void log.openLog(entry)} />
        </details>
      )}
      {log.dialog}
    </Card>
  );
}
