"use client";

import { buttonClasses } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { openSearchInstead } from "@/lib/search-dialog";

/**
 * "Rate a record" on the home page's lilac block: the same search as the tab bar's "+"
 * (the header's field on a wide screen), a plain link to /search without JavaScript.
 */
export function RateButton({ label }: { label: string }) {
  return (
    <Link
      href="/search"
      aria-haspopup="dialog"
      onClick={openSearchInstead}
      className={buttonClasses("ink")}
    >
      <PlusIcon className="size-5" />
      {label}
    </Link>
  );
}
