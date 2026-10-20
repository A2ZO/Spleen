import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function SectionHeading({
  id,
  children,
  action,
  className,
}: {
  id?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex items-end justify-between gap-4 border-b border-border/60 pb-2",
        className,
      )}
    >
      <h2 id={id} className="font-serif text-2xl">
        {children}
      </h2>
      {action}
    </div>
  );
}
