"use client";

import { RATING_MAX, RATING_MIN, ratingToStars } from "@spleen/validators";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

import { Stars } from "./Stars";

export interface StarRatingProps {
  /** Rating on the 1..10 scale, null when not rated. */
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}

/**
 * Half-star rating input. Exposed as a slider: arrows/Home/End adjust,
 * Delete/Backspace clears. Pointer position picks the half star under the cursor.
 */
export function StarRating({ value, onChange, className }: StarRatingProps) {
  const t = useTranslations("rating");
  const ref = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const fromPointer = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const ratio = (clientX - box.left) / box.width;
    return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.ceil(ratio * RATING_MAX)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = value ?? 0;
    const next: Record<string, number | null> = {
      ArrowRight: Math.min(RATING_MAX, current + 1),
      ArrowUp: Math.min(RATING_MAX, current + 1),
      ArrowLeft: Math.max(RATING_MIN, current - 1),
      ArrowDown: Math.max(RATING_MIN, current - 1),
      Home: RATING_MIN,
      End: RATING_MAX,
      Delete: null,
      Backspace: null,
    };
    if (event.key in next) {
      event.preventDefault();
      onChange(next[event.key] ?? null);
    }
  };

  const shown = hover ?? value;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={t("sliderLabel")}
        aria-valuemin={RATING_MIN}
        aria-valuemax={RATING_MAX}
        aria-valuenow={value ?? undefined}
        aria-valuetext={
          value === null ? t("empty") : t("valueText", { stars: ratingToStars(value) })
        }
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setHover(fromPointer(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const picked = fromPointer(e.clientX);
          if (picked !== null) onChange(picked === value ? null : picked);
        }}
        className="cursor-pointer touch-none rounded-sm text-3xl leading-none"
      >
        <Stars rating={shown} />
      </div>
      <span id={hintId} className="sr-only">
        {t("keyboardHint")}
      </span>
    </div>
  );
}
