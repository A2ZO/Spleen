import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export interface LinkTab {
  id: string;
  label: string;
  href: string;
}

/**
 * Section navigation rendered on the server: each tab is a link (shareable, paginated
 * content per tab), the current one marked with `aria-current`.
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
      <ul className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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
    </nav>
  );
}
