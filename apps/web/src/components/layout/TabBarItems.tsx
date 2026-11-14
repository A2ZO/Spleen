"use client";

import { buttonClasses } from "@/components/ui/Button";
import {
  BellIcon,
  CompassIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  SignInIcon,
  UserIcon,
} from "@/components/ui/icons";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { openSearchInstead } from "@/lib/search-dialog";

import { isActive } from "./nav-active";
import { NotificationBadge } from "./NotificationBadge";

const ICONS = {
  home: HomeIcon,
  discover: CompassIcon,
  notifications: BellIcon,
  profile: UserIcon,
  signIn: SignInIcon,
};

export type Tab =
  | { kind: "link"; icon: keyof typeof ICONS; href: string; label: string; unread?: number }
  /** Members' "+": opens the search, cursor in the field (`/search` without JavaScript). */
  | { kind: "rate"; label: string }
  /** Visitors' magnifier: the same search. */
  | { kind: "search"; label: string };

const item =
  "relative flex size-12 flex-col items-center justify-center rounded-full text-fg-muted hover:text-fg";
/** The current tab: lilac icon and a lilac dot under it (not colour alone: the dot). */
const current = "text-accent hover:text-accent";
const dot = "absolute bottom-1 size-[5px] rounded-full bg-accent";

export function TabBarItems({ label, tabs }: { label: string; tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav id="tab-bar" aria-label={label} className="tab-bar md:hidden">
      <ul className="mx-auto flex h-16 max-w-md items-center justify-around rounded-full border border-border bg-surface px-2 shadow-card">
        {tabs.map((tab) => {
          if (tab.kind === "rate") {
            return (
              <li key="rate">
                <Link
                  href="/search"
                  aria-haspopup="dialog"
                  aria-label={tab.label}
                  onClick={openSearchInstead}
                  className={buttonClasses("primary", undefined, "icon-lg")}
                >
                  <PlusIcon className="size-6" />
                </Link>
              </li>
            );
          }
          if (tab.kind === "search") {
            const active = isActive(pathname, "/search");
            return (
              <li key="search">
                <Link
                  href="/search"
                  aria-haspopup="dialog"
                  aria-current={active ? "page" : undefined}
                  onClick={openSearchInstead}
                  className={cn(item, active && current)}
                >
                  <SearchIcon className="size-6" />
                  <span className="sr-only">{tab.label}</span>
                  {active && <span aria-hidden className={dot} />}
                </Link>
              </li>
            );
          }
          const Icon = ICONS[tab.icon];
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                prefetch="auto"
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(item, active && current)}
              >
                <span className="relative">
                  <Icon className="size-6" />
                  {tab.unread ? <NotificationBadge unread={tab.unread} /> : null}
                </span>
                <span className="sr-only">{tab.label}</span>
                {active && <span aria-hidden className={dot} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
