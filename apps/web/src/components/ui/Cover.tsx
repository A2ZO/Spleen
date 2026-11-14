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
 * deterministic placeholder derived from the slug. While a real cover loads
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
        "@container relative aspect-square overflow-hidden rounded-thumb bg-surface shadow-cover",
        className,
      )}
    >
      {coverUrl ? (
        <CoverImage src={coverUrl} sizes={sizes ?? "200px"} fallback={generated} />
      ) : (
        generated
      )}
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
  const seed = hash >>> 8;
  // With the title printed at the bottom, every shape stays in the top half (y <= 48 of 100)
  // so the title never sits on a band; without text, the shape is centred and larger.
  const cy = showText ? 24 : 50;
  const cx = showText ? 30 + (seed % 40) : 40 + (seed % 20);

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
          <LabelBand y={showText ? 8 + (seed % 22) : 30 + (seed % 30)} ink={ink} accent={accent} />
        )}
        {style === "moon" && (
          <Moon cx={cx} cy={cy} r={showText ? 18 : 30} bg={bg} accent={accent} />
        )}
        {style === "grooves" && (
          <g fill="none" stroke={accent} strokeWidth="0.8" opacity="0.9">
            {(showText ? [22, 17, 12] : [44, 38, 32, 26, 20, 14]).map((r) => (
              <circle key={r} cx={cx} cy={cy} r={r} />
            ))}
            <circle cx={cx} cy={cy} r={showText ? 5 : 7} fill={accent} />
          </g>
        )}
        {style === "stripes" && (
          // At most 8 degrees with text: the 140-wide bands then stay above y = 48.
          <g
            transform={`rotate(-${showText ? seed % 9 : 10 + (seed % 25)} 50 ${showText ? 24 : 50})`}
          >
            <rect x="-20" y={cy - 16} width="140" height="10" fill={accent} />
            <rect x="-20" y={cy - 2} width="140" height="4" fill={ink} opacity="0.8" />
            <rect x="-20" y={cy + 4} width="140" height="10" fill={accent} opacity="0.6" />
          </g>
        )}
      </svg>
      {showText && (
        <div className="absolute inset-x-0 bottom-0 p-[7cqw]">
          <p className="line-clamp-3 font-display text-[11cqw] leading-[1.05] font-extrabold tracking-[-0.02em]">
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

function LabelBand({ y, ink, accent }: { y: number; ink: string; accent: string }) {
  return (
    <>
      <rect x="0" y={y} width="100" height="9" fill={accent} />
      <rect x="0" y={y + 12} width="62" height="3" fill={ink} opacity="0.85" />
    </>
  );
}

function Moon({
  cx,
  cy,
  r,
  bg,
  accent,
}: {
  cx: number;
  cy: number;
  r: number;
  bg: string;
  accent: string;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={accent} />
      <circle cx={cx + r * 0.42} cy={cy - r * 0.25} r={r * 0.92} fill={bg} />
    </>
  );
}
