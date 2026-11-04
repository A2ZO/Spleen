import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Loading skeletons (`loading.tsx`): grey shapes where the page's blocks will be. The whole
 * skeleton fades in after 150 ms (`animate-skeleton`), so a fast navigation shows nothing.
 */

/** Wrapper of a page skeleton: announced once to screen readers, drawn after the delay. */
export async function PageSkeleton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const t = await getTranslations("common");
  return (
    <div role="status" aria-live="polite" className="animate-skeleton">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  );
}

/** A plain block (text line, button…); `round` for avatars and badges. */
export function Bone({ className, round = false }: { className?: string; round?: boolean }) {
  return <div className={cn("bg-surface", round ? "rounded-full" : "rounded-md", className)} />;
}

/** An empty sleeve with the label of a record in its middle. */
export function CoverBone({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-square rounded-sm bg-surface", className)}>
      <div className="absolute inset-[30%] rounded-full bg-surface-raised" />
    </div>
  );
}

/** Text lines of decreasing length. */
export function LinesBone({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-1/2"];
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={cn("h-3", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** A grid of release tiles: sleeve, title, artist. */
export function TileGridBone({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <CoverBone />
          <Bone className="h-3 w-4/5" />
          <Bone className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** A section title followed by `children`. */
export function SectionBone({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-5">
      <Bone className="h-6 w-48" />
      {children}
    </section>
  );
}

/** Review or feed cards: small sleeve, then text. */
export function CardListBone({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-4">
          <CoverBone className="w-16 shrink-0" />
          <LinesBone lines={3} className="flex-1 pt-1" />
        </div>
      ))}
    </div>
  );
}
