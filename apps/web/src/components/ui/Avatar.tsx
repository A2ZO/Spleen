import { cn } from "@/lib/cn";
import { hashString } from "@/lib/hash";

const TONES = ["bg-accent", "bg-midnight", "bg-wood-dark"] as const;

/**
 * Uploaded avatar, or initials when there is none. Decorative: the name is always shown
 * nearby.
 */
export function Avatar({
  name,
  seed,
  src,
  className,
}: {
  name: string;
  seed: string;
  src?: string | null;
  className?: string;
}) {
  const frame = "inline-flex size-10 shrink-0 rounded-full ring-2 ring-border";

  if (src) {
    return (
      // Plain <img>: member uploads come from our storage host (R2 or the dev route),
      // already resized to 512 px, so Next's optimizer would add nothing.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={cn(frame, "object-cover", className)} />
    );
  }

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const tone = TONES[hashString(seed) % TONES.length];

  return (
    <span
      aria-hidden="true"
      className={cn(
        frame,
        "items-center justify-center font-serif text-accent-fg italic",
        tone,
        className,
      )}
    >
      {initials}
    </span>
  );
}
