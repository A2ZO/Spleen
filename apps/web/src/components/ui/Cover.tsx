import { coverSwatches } from "@spleen/design-tokens";

import { cn } from "@/lib/cn";
import { hashString } from "@/lib/hash";

import { CoverImage } from "./CoverImage";

export interface CoverProps {
  slug: string;
  title: string;
  artistName?: string;
  coverUrl?: string | null;
  /** Accessible description; omit when the title is already readable next to the cover. */
  alt?: string;
  className?: string;
  sizes?: string;
  /** Hide the printed title on thumbnails too small to read it. */
  showText?: boolean;
}

/**
 * Album sleeve. Uses the real cover when there is one, otherwise a generated,
 * deterministic jazz-label style placeholder derived from the slug. While a real cover loads
 * (or when it fails without JavaScript) the plain surface shows: never a made-up sleeve under
 * real artwork, never a broken-image icon. The accessible name is the sleeve's, not the image's.
 */
export function Cover({
  slug,
  title,
  artistName,
  coverUrl,
  alt = "",
  className,
  sizes,
  showText = true,
}: CoverProps) {
  const generated = (
    <GeneratedCover slug={slug} title={title} artistName={artistName} showText={showText} />
  );
  return (
    <div
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      className={cn(
        "@container relative aspect-square overflow-hidden rounded-sm bg-surface shadow-cover",
        className,
      )}
    >
      {coverUrl ? (
        <CoverImage src={coverUrl} sizes={sizes ?? "200px"} fallback={generated} />
      ) : (
        generated
      )}
      {/* Sleeve sheen and worn edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/25 ring-1 ring-black/20 ring-inset"
      />
    </div>
  );
}

const STYLES = ["label", "moon", "grooves", "stripes"] as const;

function GeneratedCover({
  slug,
  title,
  artistName,
  showText,
}: {
  slug: string;
  title: string;
  artistName?: string;
  showText: boolean;
}) {
  const hash = hashString(slug);
  const [bg, ink, accent] = coverSwatches[hash % coverSwatches.length]!;
  const style = STYLES[(hash >>> 4) % STYLES.length]!;
  const offset = 20 + ((hash >>> 8) % 50);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ backgroundColor: bg, color: ink }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        {style === "label" && (
          <>
            <rect x="0" y={offset} width="100" height="9" fill={accent} />
            <rect x="0" y={offset + 12} width="62" height="3" fill={ink} opacity="0.85" />
          </>
        )}
        {style === "moon" && (
          <>
            <circle cx={offset + 15} cy="38" r="24" fill={accent} />
            <circle cx={offset + 25} cy="32" r="22" fill={bg} />
          </>
        )}
        {style === "grooves" && (
          <g fill="none" stroke={accent} strokeWidth="0.8" opacity="0.9">
            {[44, 38, 32, 26, 20, 14].map((r) => (
              <circle key={r} cx={offset + 25} cy="40" r={r} />
            ))}
            <circle cx={offset + 25} cy="40" r="7" fill={accent} />
          </g>
        )}
        {style === "stripes" && (
          <g transform={`rotate(-${offset / 2} 50 50)`}>
            <rect x="-20" y="22" width="140" height="10" fill={accent} />
            <rect x="-20" y="36" width="140" height="4" fill={ink} opacity="0.8" />
            <rect x="-20" y="44" width="140" height="10" fill={accent} opacity="0.6" />
          </g>
        )}
      </svg>
      {showText && (
        <div className="absolute inset-x-0 bottom-0 p-[7cqw]">
          <p className="line-clamp-3 font-serif text-[11cqw] leading-[1.05] font-semibold italic">
            {title}
          </p>
          {artistName && (
            <p className="mt-[2cqw] truncate font-mono text-[5.5cqw] tracking-[0.12em] uppercase opacity-80">
              {artistName}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
