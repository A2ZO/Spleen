"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CheckIcon, ClockIcon, HeartIcon } from "@/components/ui/icons";
import { StarRating } from "@/components/ui/StarRating";
import { cn } from "@/lib/cn";

import { Turntable } from "./Turntable";

/**
 * "I listened" panel. Mockup only: state is local and lost on reload.
 * Milestone 5 wires these to `entry.create` / `itemState.update` procedures.
 */
export function ListenControls() {
  const t = useTranslations("album.actions");
  const [listened, setListened] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [queued, setQueued] = useState(false);

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
      className="rounded-md border border-border/60 bg-surface p-4 shadow-card"
    >
      <h2 id="listen-title" className="sr-only">
        {t("title")}
      </h2>
      <div className="flex items-center gap-3">
        <Turntable playing={listened} className="h-12 w-16 shrink-0" />
        <button
          type="button"
          aria-pressed={listened}
          onClick={() => setListened((v) => !v)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 font-medium transition-colors",
            listened
              ? "border border-star text-star"
              : "bg-accent text-accent-fg shadow-card hover:bg-accent-hover",
          )}
        >
          {listened && <CheckIcon />}
          {listened ? t("listenedDone") : t("listened")}
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <StarRating
          value={rating}
          onChange={(value) => {
            setRating(value);
            if (value !== null) setListened(true);
          }}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          aria-pressed={liked}
          onClick={() => setLiked((v) => !v)}
          className={toggleClasses(liked)}
        >
          <HeartIcon filled={liked} className="text-lg" />
          {t("like")}
        </button>
        <button
          type="button"
          aria-pressed={queued}
          onClick={() => setQueued((v) => !v)}
          className={toggleClasses(queued)}
        >
          <ClockIcon className="text-lg" />
          {t("wantToListen")}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-fg-muted italic">{t("mockNote")}</p>
    </section>
  );
}
