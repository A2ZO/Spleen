import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

import { ActiveTabIntoView } from "./ActiveTabIntoView";

export interface LinkTab {
  id: string;
  label: string;
  href: string;
}

/**
 * Section navigation rendered on the server: each tab is a link (shareable, paginated
 * content per tab), the current one marked with `aria-current` and scrolled into view when
 * the list overflows (small screens).
 */
export function LinkTabs({
  tabs,
  current,
  label,
  className,
}: {
  tabs: LinkTab[];
  current: string;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      {/* Bottom rule drawn inside the list: a border plus overlapping tab underlines would
          overflow by 1px and give the scrolling list a vertical scrollbar. */}
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:thin] shadow-[inset_0_-1px_0_var(--color-border)]">
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  selected
                    ? "border-star text-fg"
                    : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <ActiveTabIntoView current={current} />
    </nav>
  );
}
