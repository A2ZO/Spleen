import type { MemoryRelease } from "@spleen/api";
import { useTranslations } from "next-intl";

import { ReleaseTile } from "@/components/release/ReleaseTile";
import { cn } from "@/lib/cn";

export interface MemoryGridItem {
  release: MemoryRelease;
  /** The record's age today: shown under the tile when given. */
  years?: number;
  /** A round anniversary: the age line is highlighted (it already says the age). */
  round?: boolean;
}

/** « Souvenirs » tiles: the trends grid, without stars, with an optional age line. */
export function MemoryGrid({ items }: { items: MemoryGridItem[] }) {
  const t = useTranslations("memories");
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(({ release, years, round }) => (
        <li key={release.id}>
          <ReleaseTile release={{ ...release, averageRating: null, ratingCount: 0 }} />
          {years !== undefined && (
            <p
              className={cn(
                "mt-1 font-mono text-xs",
                round ? "font-semibold text-star" : "text-fg-muted",
              )}
            >
              {t("age", { years })}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
