"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";

import { buttonClasses } from "@/components/ui/Button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";

/**
 * Did the member reach this page from another Spleen page? Either the tab moved inside the app
 * since the document loaded (client navigation), or the document itself was opened from a
 * Spleen page (same-origin referrer).
 */
function cameFromSpleen() {
  const [load] = performance.getEntriesByType("navigation");
  if (load && load.name !== location.href) return true;
  try {
    return document.referrer !== "" && new URL(document.referrer).origin === location.origin;
  } catch {
    return false;
  }
}

/**
 * "←" of the mobile detail bar: a real link to the parent page (works without JS, or when the
 * page was opened from outside), and the browser's "back" when the member came from Spleen.
 */
export function BackLink({ href }: { href: string }) {
  const t = useTranslations("detail");
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!cameFromSpleen()) return;
    event.preventDefault();
    history.back();
  };
  return (
    <Link href={href} onClick={onClick} className={buttonClasses("secondary", "text-xl", "icon")}>
      <ChevronLeftIcon />
      <span className="sr-only">{t("back")}</span>
    </Link>
  );
}
