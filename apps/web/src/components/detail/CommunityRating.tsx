import { ratingToStars } from "@spleen/validators";
import { getFormatter, getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/Card";
import { RatingHistogram } from "@/components/ui/RatingHistogram";
import { cn } from "@/lib/cn";

/**
 * The page's lilac block: community average (big number), count and, for records, the
 * distribution (from `md`). Blind mode replaces the number with its message.
 */
export async function CommunityRating({
  average,
  count,
  hidden,
  distribution,
  className,
}: {
  /** 1..10 average, null without ratings or in blind mode. */
  average: number | null;
  count: number;
  hidden: boolean;
  distribution?: number[];
  className?: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const stars =
    average === null
      ? null
      : format.number(ratingToStars(average), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });

  return (
    <Card
      tone="accent"
      role="region"
      aria-labelledby="community-rating"
      className={cn("flex flex-col gap-3 md:gap-4", className)}
    >
      <h2
        id="community-rating"
        className="font-mono text-[11px] font-normal tracking-[0.06em] uppercase md:text-xs"
      >
        {t("detail.community")}
      </h2>
      {hidden ? (
        <p className="text-[15px] leading-snug">{t("listening.blindHidden")}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2">
          <p className="font-display text-[64px] leading-[0.8] font-extrabold tracking-[-0.04em] md:text-[104px] md:leading-[0.78]">
            {stars === null ? (
              "–"
            ) : (
              <>
                {stars}
                <span className="sr-only"> {t("detail.outOfFive")}</span>
              </>
            )}
          </p>
          <p className="text-[13px] leading-tight md:text-[15px]">
            {stars !== null && (
              <span aria-hidden="true" className="max-md:hidden">
                {t("detail.outOfFive")}
                <br />
              </span>
            )}
            {count === 0 ? t("rating.none") : t("rating.count", { count })}
          </p>
        </div>
      )}
      {distribution && !hidden && count > 0 && (
        <RatingHistogram
          tone="on-accent"
          distribution={distribution}
          label={t("album.distributionLabel")}
          className="max-md:hidden"
        />
      )}
    </Card>
  );
}
