import { ratingToStars } from "@spleen/validators";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/cn";

/** Ten brass bars, one per half-star value. Includes a screen-reader list of the counts. */
export function RatingHistogram({
  distribution,
  label,
  className,
}: {
  distribution: number[];
  label: string;
  className?: string;
}) {
  const t = useTranslations("rating");
  const format = useFormatter();
  const max = Math.max(1, ...distribution);

  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <div aria-hidden="true" className="flex h-16 items-end gap-[3px]">
        {distribution.map((count, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] bg-star/80 transition-[height]"
            style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-1 flex justify-between font-mono text-[0.7rem] text-fg-muted"
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
