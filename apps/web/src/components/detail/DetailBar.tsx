import type { ReactNode } from "react";

import { BackLink } from "./BackLink";
import { MoreMenu } from "./MoreMenu";

/**
 * Top bar of a detail page on phones (album, artist, track, review): back, a mono label
 * ("ALBUM · 2025"), and "⋯" when the visitor has actions. It replaces the site header row
 * there (`[data-detail-bar]`, globals.css); from `md` the pill header is back and this is gone.
 */
export function DetailBar({
  backHref,
  label,
  actions,
  thumb,
}: {
  backHref: string;
  label: string;
  /** Entries of the "⋯" menu (`moreMenuItem`); no menu without them. */
  actions?: ReactNode;
  /**
   * Small cover that fades in as the page's big cover scrolls away (`.cover-thumb`, linked to
   * the `.cover-scroll` wrapper inside a `.cover-scope`). Decorative; hidden where the
   * scroll-linked animation cannot run.
   */
  thumb?: ReactNode;
}) {
  return (
    <div
      data-detail-bar
      className="sticky top-0 z-40 -mx-4 mb-4 flex items-center gap-3 bg-bg/90 px-3.5 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 md:hidden"
    >
      <BackLink href={backHref} />
      {thumb && (
        <span aria-hidden="true" className="cover-thumb w-8 shrink-0">
          {thumb}
        </span>
      )}
      <p className="min-w-0 flex-1 truncate text-center font-mono text-xs tracking-[0.06em] text-fg-muted uppercase">
        {label}
      </p>
      {actions ? <MoreMenu>{actions}</MoreMenu> : <span aria-hidden="true" className="size-11" />}
    </div>
  );
}
