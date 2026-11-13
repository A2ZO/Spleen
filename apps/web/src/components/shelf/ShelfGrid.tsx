import type { ReleaseCard } from "@spleen/api";
import { useTranslations } from "next-intl";

import { Cover } from "@/components/ui/Cover";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * The Shelf: rounded sleeves in a grid, each title in an opaque pill (its contrast never
 * depends on the artwork). `showEmpty` keeps the free slots as dashed tiles (the owner's own
 * Shelf); otherwise only the records are shown and the grid adapts to how many there are.
 */
export function ShelfGrid({
  items,
  showEmpty = false,
  className,
}: {
  items: (ReleaseCard | null)[];
  showEmpty?: boolean;
  className?: string;
}) {
  const t = useTranslations("profile");
  const slots = showEmpty ? items : items.filter((item) => item !== null);

  return (
    <ul className={cn("grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5", className)}>
      {slots.map((item, index) => (
        <li key={item?.id ?? `empty-${index}`}>
          {item ? (
            <Link
              href={`/album/${item.slug}`}
              className="relative block rounded-cover focus-visible:outline-offset-4"
            >
              <Cover
                slug={item.slug}
                title={item.title}
                artistName={item.artists[0]?.name}
                coverUrl={item.coverUrl}
                sizes="(min-width: 768px) 280px, 50vw"
                className="rounded-cover"
                showText={false}
              />
              <span
                aria-hidden="true"
                className="absolute right-3 bottom-3 left-3 flex md:right-4 md:bottom-4 md:left-4"
              >
                <span className="min-w-0 truncate rounded-full bg-bg px-3 py-1.5 text-xs font-semibold text-fg md:text-sm">
                  {item.title}
                </span>
              </span>
              <span className="sr-only">
                {item.title}, {item.artists.map((a) => a.name).join(", ")}
              </span>
            </Link>
          ) : (
            <div className="aspect-square rounded-cover border-2 border-dashed border-border-field">
              <span className="sr-only">{t("shelfEmptySlot")}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
