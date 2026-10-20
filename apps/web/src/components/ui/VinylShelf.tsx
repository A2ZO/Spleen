import type { ReleaseCard } from "@spleen/api";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

import { Cover } from "./Cover";

/** Record peeking out of its sleeve; slides further out on hover / focus. */
function Vinyl() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="absolute inset-y-[3%] right-0 h-[94%] w-auto translate-x-[22%] transition-transform duration-500 ease-spleen group-hover:translate-x-[48%] group-focus-visible:translate-x-[48%]"
    >
      <circle cx="50" cy="50" r="49.5" strokeWidth="1" className="fill-vinyl stroke-vinyl-groove" />
      {[46, 42, 38, 34, 30, 26].map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          className="stroke-vinyl-groove"
          strokeWidth="0.6"
        />
      ))}
      <path
        d="M20 22a42 42 0 0 1 30-12"
        className="stroke-vinyl-groove"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="50" cy="50" r="16" className="fill-accent" />
      <circle cx="50" cy="50" r="2" className="fill-bg" />
    </svg>
  );
}

export function VinylShelf({
  items,
  emptyMessage,
  className,
}: {
  /** Exactly 4 slots; null = empty slot. */
  items: (ReleaseCard | null)[];
  emptyMessage: string;
  className?: string;
}) {
  const t = useTranslations();
  const isEmpty = items.every((item) => item === null);

  return (
    <div className={cn("relative", className)}>
      <ul className="relative z-10 grid grid-cols-4 gap-x-4 px-1 pb-3 sm:gap-x-10 sm:px-2">
        {items.map((item, index) => (
          <li key={item?.id ?? `empty-${index}`} className="relative">
            {item ? (
              <Link
                href={`/album/${item.slug}`}
                className="group relative block w-[86%] rounded-sm focus-visible:outline-offset-4"
              >
                <Vinyl />
                <Cover
                  slug={item.slug}
                  title={item.title}
                  artistName={item.artists[0]?.name}
                  coverUrl={item.coverUrl}
                  sizes="(min-width: 640px) 240px, 25vw"
                  className="relative z-10 transition-transform duration-500 ease-spleen group-hover:-translate-y-1 group-hover:-rotate-1"
                />
                <span className="sr-only">
                  {item.title}, {item.artists.map((a) => a.name).join(", ")}
                </span>
              </Link>
            ) : (
              <div className="flex aspect-square w-[86%] items-center justify-center rounded-sm border border-dashed border-border bg-surface/40">
                <span className="sr-only">{t("profile.shelfEmptySlot")}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {/* The wooden plank. */}
      <div
        aria-hidden="true"
        className="relative -mt-4 h-5 rounded-[2px] bg-gradient-to-b from-wood to-wood-dark shadow-shelf"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
        <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(90deg,transparent_0_38px,rgb(0_0_0/0.25)_38px_39px,transparent_39px_90px)]" />
      </div>
      {isEmpty && (
        <p className="mt-4 text-center font-serif text-lg text-fg-muted italic">{emptyMessage}</p>
      )}
    </div>
  );
}
