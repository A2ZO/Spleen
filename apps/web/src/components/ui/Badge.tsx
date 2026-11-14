import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** Small uppercase mono label ("ALBUM", "2025", "9 TITRES · 38 MIN"). */
export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-raised px-3 py-1.5 font-mono text-xs leading-none tracking-[0.06em] text-fg uppercase",
        className,
      )}
      {...props}
    />
  );
}
