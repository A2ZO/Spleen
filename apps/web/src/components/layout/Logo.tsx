import { cn } from "@/lib/cn";

/** Wordmark: the lilac crescent moon, then "spleen" in heavy grotesque. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-2xl", className)}>
      <svg aria-hidden="true" viewBox="14.25 2.75 15 15" className="size-[0.95em] shrink-0">
        <path d="M22 3.5a7 7 0 1 0 6.5 9.5 5.5 5.5 0 0 1-6.5-9.5Z" className="fill-accent" />
      </svg>
      <span className="font-display leading-none font-extrabold tracking-[-0.03em]">spleen</span>
    </span>
  );
}
