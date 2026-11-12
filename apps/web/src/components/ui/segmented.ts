import { cn } from "@/lib/cn";

/*
 * Segmented control shared by `Tabs` (client) and `LinkTabs` (server): a pill track with
 * 44 px pills. The active pill is always lilac (not just a lighter fill, WCAG 1.4.11).
 * The focus ring sits 2 px off the pill, inside the track's 4 px padding, so the scrolling
 * track never clips it.
 */
export const segmentedTrack =
  "flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 shadow-card [scrollbar-width:none]";

export function segmentedItem(selected: boolean) {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-[18px] text-sm font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-offset-2",
    selected ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
  );
}
