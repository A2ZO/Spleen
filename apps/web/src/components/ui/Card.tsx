import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Big rounded tile with a 1 px top sheen and a drop shadow. `accent` is the one full lilac
 * block of a page: its focus rings turn ink (`on-accent`). `lift`: the card is one whole link
 * and rises a little under a mouse (`hover:` only applies where hovering exists).
 */
export function Card({
  className,
  tone = "default",
  lift = false,
  ...props
}: ComponentProps<"div"> & { tone?: "default" | "accent"; lift?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card-sm p-5 md:rounded-card md:p-6",
        tone === "accent"
          ? "on-accent bg-accent text-accent-fg shadow-accent-block"
          : "border border-border bg-surface shadow-card",
        lift && "transition-transform duration-150 ease-spleen motion-safe:hover:-translate-y-1",
        className,
      )}
      {...props}
    />
  );
}
