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
    <div className={cn("mb-5 flex items-end justify-between gap-4", className)}>
      <h2 id={id} className="font-display text-[22px] font-bold tracking-[-0.02em] md:text-[34px]">
        {children}
      </h2>
      {action}
    </div>
  );
}
