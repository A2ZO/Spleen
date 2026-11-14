import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/*
 * Rounded label: a genre, a streaming service, a sleeve title on the Shelf.
 * - `outline`: thin border on the page (genres).
 * - `raised`: dark filled pill (streaming services).
 * - `overlay`: near-black pill laid on a cover.
 * As a link it keeps a 44 px target.
 */
type Tone = "outline" | "raised" | "overlay";

const tones: Record<Tone, string> = {
  outline: "border border-border text-fg",
  raised: "bg-surface-raised text-fg shadow-button-sm",
  overlay: "bg-bg/90 text-fg",
};

export function pillClasses(tone: Tone = "outline", className?: string) {
  return cn(
    "inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3.5 py-1.5 text-sm font-medium",
    tones[tone],
    className,
  );
}

export function Pill({ tone, className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return <span className={pillClasses(tone, className)} {...props} />;
}

export function PillLink({
  tone,
  className,
  ...props
}: ComponentProps<typeof Link> & { tone?: Tone }) {
  return (
    <Link
      className={pillClasses(
        tone,
        cn("min-h-11 hover:border-fg-muted hover:text-fg", className),
      )}
      {...props}
    />
  );
}
