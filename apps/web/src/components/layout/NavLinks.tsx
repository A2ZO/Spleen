"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

import { isActive } from "./nav-active";

/**
 * Desktop navigation links in the floating bar. The current page gets a raised pill, full
 * ink and a lilac dot under its label (the tab bar's mark), not just a lighter fill.
 */
export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              prefetch="auto"
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap",
                active
                  ? "bg-surface-raised text-fg after:absolute after:bottom-1 after:left-1/2 after:size-[5px] after:-translate-x-1/2 after:rounded-full after:bg-accent"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
