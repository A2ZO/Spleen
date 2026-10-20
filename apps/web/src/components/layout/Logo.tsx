import { cn } from "@/lib/cn";

/** Wordmark: "Spleen" in italic serif, with a crescent moon resting on a record. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
        <circle cx="16" cy="18" r="13" className="fill-vinyl" />
        <circle
          cx="16"
          cy="18"
          r="9"
          fill="none"
          strokeWidth="0.6"
          className="stroke-vinyl-groove"
        />
        <circle cx="16" cy="18" r="4" className="fill-accent" />
        <path d="M22 3.5a7 7 0 1 0 6.5 9.5 5.5 5.5 0 0 1-6.5-9.5Z" className="fill-star" />
      </svg>
      <span className="font-serif text-2xl leading-none font-semibold tracking-tight italic">
        Spleen
      </span>
    </span>
  );
}
