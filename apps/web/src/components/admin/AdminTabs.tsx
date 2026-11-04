"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", key: "reports" },
  { href: "/admin/history", key: "history" },
  { href: "/admin/suspended", key: "suspended" },
  { href: "/admin/merge", key: "merge" },
] as const;

/** Sections of the moderation area (the current one follows the path). */
export function AdminTabs() {
  const t = useTranslations("admin.tabs");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]">
        {TABS.map((tab) => {
          const current = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                  current
                    ? "border-star text-fg"
                    : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
