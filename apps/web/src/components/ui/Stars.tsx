import { cn } from "@/lib/cn";

const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z";

function StarRow({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <span className={cn("flex", className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="size-[1em] shrink-0">
          <path
            d={STAR_PATH}
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={filled ? 0 : 1.4}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * Visual-only star bar for a rating on the 1..10 scale (half-stars).
 * Fractional averages are drawn proportionally. Callers provide the accessible text.
 */
export function Stars({ rating, className }: { rating: number | null; className?: string }) {
  const percent = rating === null ? 0 : (rating / 10) * 100;
  return (
    <span className={cn("relative inline-flex text-star", className)}>
      <StarRow filled={false} className="opacity-45" />
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${percent}%` }}>
        <StarRow filled />
      </span>
    </span>
  );
}
