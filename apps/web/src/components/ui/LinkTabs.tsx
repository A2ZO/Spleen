import { Link } from "@/i18n/navigation";

import { ActiveTabIntoView } from "./ActiveTabIntoView";
import { segmentedItem, segmentedTrack } from "./segmented";

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
      <ul className={segmentedTrack}>
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={segmentedItem(selected)}
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
