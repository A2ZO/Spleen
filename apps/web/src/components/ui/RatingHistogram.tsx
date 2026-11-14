import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/**
 * Ten bars, one per half-star value. Includes a screen-reader list of the counts.
 * `on-accent`: ink bars on the lilac block (community rating).
 */
export function RatingHistogram({
  distribution,
  label,
  className,
  tone = "default",
}: {
  distribution: number[];
  label: string;
  className?: string;
  tone?: "default" | "on-accent";
}) {
  const t = useTranslations("rating");
  const format = useFormatter();
  const max = Math.max(1, ...distribution);

  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <div aria-hidden="true" className="flex h-15 items-end gap-[5px]">
        {distribution.map((count, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[4px]",
              tone === "on-accent" ? "bg-accent-fg" : "bg-star/80",
            )}
            style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "mt-1 flex justify-between font-mono text-[0.7rem]",
          tone === "default" && "text-fg-muted",
        )}
      >
        <span>½</span>
        <span>5 ★</span>
      </div>
      <ul className="sr-only">
        {distribution.map((count, i) => (
          <li key={i}>
            {t("valueText", { stars: ratingToStars(i + 1) })} : {format.number(count)}
          </li>
        ))}
      </ul>
    </figure>
  );
}
