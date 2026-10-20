import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-md border border-border/60 bg-surface p-4 shadow-card", className)}
      {...props}
    />
  );
}
