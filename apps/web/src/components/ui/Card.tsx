import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Big rounded tile with a 1 px top sheen and a drop shadow. `accent` is the one full lilac
 * block of a page: its focus rings turn ink (`on-accent`).
 */
export function Card({
  className,
  tone = "default",
  ...props
}: ComponentProps<"div"> & { tone?: "default" | "accent" }) {
  return (
    <div
      className={cn(
        "rounded-card-sm p-5 md:rounded-card md:p-6",
        tone === "accent"
          ? "on-accent bg-accent text-accent-fg shadow-accent-block"
          : "border border-border bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}
