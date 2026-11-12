import { cn } from "@/lib/cn";

const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z";

/*
 * Each star sits in an equal cell (padding on both sides, no gap), so the clipped overlay's
 * width maps linearly to the rating: 10 % of the row is exactly half of the first star.
 */
function StarRow({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <span className={cn("flex", className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="box-content size-[1em] shrink-0 px-[0.06em]">
          <path
            d={STAR_PATH}
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={filled ? 0 : 1.6}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * Visual-only star bar for a rating on the 1..10 scale (half-stars).
 * Fractional averages are drawn proportionally. Empty stars are outlined in `star-empty`
 * (3:1 on surfaces). Callers provide the accessible text.
 */
export function Stars({ rating, className }: { rating: number | null; className?: string }) {
  const percent = rating === null ? 0 : (rating / 10) * 100;
  return (
    <span className={cn("relative inline-flex text-star", className)}>
      <StarRow filled={false} className="text-star-empty" />
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${percent}%` }}>
        <StarRow filled />
      </span>
    </span>
  );
}
