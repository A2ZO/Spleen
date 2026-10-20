import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[0.7rem] tracking-wider text-fg-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}
