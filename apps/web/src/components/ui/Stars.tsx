import { cn } from "@/lib/cn";

const STAR_PATH =
  "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z";

/*
 * Each star sits in an equal cell (padding on both sides, no gap), so the clipped overlay's
 * width maps linearly to the rating: 10 % of the row is exactly half of the first star.
 */
function StarRow({
  className,
  filled,
  pop = false,
}: {
  className?: string;
  filled: boolean;
  pop?: boolean;
}) {
  return (
    <span className={cn("flex", className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={cn("box-content size-[1em] shrink-0 px-[0.06em]", pop && "star-pop")}
          style={pop ? { animationDelay: `${i * 40}ms` } : undefined}
        >
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
export function Stars({
  rating,
  className,
  tone = "default",
  pop = 0,
}: {
  rating: number | null;
  className?: string;
  /** `on-accent`: ink stars for a lilac block. */
  tone?: "default" | "on-accent";
  /**
   * Bumped by `StarRating` when a rating is picked: the filled stars bounce in one by one
   * (`.star-pop`, globals.css). 0 = still (never on the first render).
   */
  pop?: number;
}) {
  const percent = rating === null ? 0 : (rating / 10) * 100;
  const onAccent = tone === "on-accent";
  return (
    <span
      className={cn("relative inline-flex", onAccent ? "text-accent-fg" : "text-star", className)}
    >
      <StarRow filled={false} className={onAccent ? "text-accent-fg/45" : "text-star-empty"} />
      <span
        key={pop}
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${percent}%` }}
      >
        <StarRow filled pop={pop > 0} />
      </span>
    </span>
  );
}
