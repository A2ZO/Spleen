import { cn } from "@/lib/cn";
import { hashString } from "@/lib/hash";

const TONES = ["bg-accent", "bg-midnight", "bg-wood-dark"] as const;

/** Initials avatar until uploads exist (milestone 3). Decorative: the name is always shown nearby. */
export function Avatar({
  name,
  seed,
  className,
}: {
  name: string;
  seed: string;
  className?: string;
}) {
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
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-accent-fg italic ring-2 ring-border",
        tone,
        className,
      )}
    >
      {initials}
    </span>
  );
}
