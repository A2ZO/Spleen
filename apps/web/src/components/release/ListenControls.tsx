"use client";

import type { MoodRef, MyEntry, MyItemState } from "@spleen/api";
import type { ListenTargetInput } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import {
  markListenedAction,
  quickLikeAction,
  quickRateAction,
  wantToListenAction,
  type ListenResult,
} from "@/app/[locale]/listening/actions";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon, ClockIcon, HeartIcon } from "@/components/ui/icons";
import { StarRating } from "@/components/ui/StarRating";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

import { LogDialog, type LogTrack } from "./LogDialog";
import { MyListens } from "./MyListens";
import { Turntable } from "./Turntable";

export interface ListenControlsProps {
  target: ListenTargetInput;
  title: string;
  /** Null when signed out (the panel then invites to sign in). */
  initial: MyItemState | null;
  moods: MoodRef[];
  /** Album tracklist, for track-by-track ratings (empty for a track page). */
  tracks: LogTrack[];
}

/**
 * "I listened" panel: one-click listen, quick rating and heart (kept on the member's undated
 * listen), "to listen" queue, and the full "log" form. Writes go through Server Actions that
 * return the fresh state; the page is then refreshed for the community figures.
 */
export function ListenControls({ target, title, initial, moods, tracks }: ListenControlsProps) {
  const t = useTranslations("album.actions");
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(
    state,
    (current, change: Partial<MyItemState>) => (current ? { ...current, ...change } : current),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<MyEntry | "new" | null>(null);

  if (!optimistic) {
    return (
      <section className="rounded-md border border-border/60 bg-surface p-4 text-center shadow-card">
        <p className="font-serif text-lg">{t("signIn")}</p>
        <Link href="/sign-in" className={buttonClasses("primary", "mt-3")}>
          {t("signInLink")}
        </Link>
      </section>
    );
  }

  const apply = (result: ListenResult) => {
    if (result.state) {
      setState(result.state);
      setError(false);
      router.refresh();
    } else {
      setError(true);
    }
  };

  const write = (change: Partial<MyItemState>, action: () => Promise<ListenResult>) =>
    startTransition(async () => {
      setOptimistic(change);
      apply(await action());
    });

  const toggleClasses = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors",
      active
        ? "border-star bg-star/10 text-star"
        : "border-border text-fg-muted hover:border-star/60 hover:text-fg",
    );

  return (
    <section
      aria-labelledby="listen-title"
      aria-busy={pending}
      className="rounded-md border border-border/60 bg-surface p-4 shadow-card"
    >
      <h2 id="listen-title" className="sr-only">
        {t("title")}
      </h2>
      <div className="flex items-center gap-3">
        <Turntable playing={optimistic.listened} className="h-12 w-16 shrink-0" />
        <button
          type="button"
          aria-pressed={optimistic.listened}
          disabled={pending}
          onClick={() =>
            write({ listened: true, wantToListen: false }, () => markListenedAction(target))
          }
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 font-medium transition-colors",
            optimistic.listened
              ? "border border-star text-star"
              : "bg-accent text-accent-fg shadow-card hover:bg-accent-hover",
          )}
        >
          {optimistic.listened && <CheckIcon />}
          {optimistic.listened ? t("listenedDone") : t("listened")}
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <StarRating
          value={optimistic.rating}
          onChange={(rating) =>
            write({ rating, listened: optimistic.listened || rating !== null }, () =>
              quickRateAction(target, rating),
            )
          }
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          aria-pressed={optimistic.liked}
          disabled={pending}
          onClick={() =>
            write({ liked: !optimistic.liked }, () => quickLikeAction(target, !optimistic.liked))
          }
          className={toggleClasses(optimistic.liked)}
        >
          <HeartIcon filled={optimistic.liked} className="text-lg" />
          {t("like")}
        </button>
        <button
          type="button"
          aria-pressed={optimistic.wantToListen}
          disabled={pending}
          onClick={() =>
            write({ wantToListen: !optimistic.wantToListen }, () =>
              wantToListenAction(target, !optimistic.wantToListen),
            )
          }
          className={toggleClasses(optimistic.wantToListen)}
        >
          <ClockIcon className="text-lg" />
          {t("wantToListen")}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setEditing("new")}
        className={buttonClasses("outline", "mt-4 w-full")}
      >
        {t("log")}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-danger">
          {t("error")}
        </p>
      )}

      <MyListens entries={optimistic.entries} moods={moods} onEdit={setEditing} />

      {editing && (
        <LogDialog
          target={target}
          title={title}
          entry={editing === "new" ? null : editing}
          state={optimistic}
          moods={moods}
          tracks={tracks}
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setEditing(null);
            apply({ state: next });
          }}
        />
      )}
    </section>
  );
}
