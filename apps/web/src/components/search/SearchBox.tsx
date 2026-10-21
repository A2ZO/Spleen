"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { SearchIcon } from "@/components/ui/icons";
import { usePathname, useRouter } from "@/i18n/navigation";

const DEBOUNCE_MS = 250;

/**
 * Search field of the search page: results update as you type (the URL is replaced, the
 * server renders the local results). Without JavaScript it is a plain GET form.
 */
export function SearchBox({ q, type }: { q: string; type: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) params.set("q", value.trim());
      if (type !== "all") params.set("type", type);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, type, pathname, router]);

  return (
    <form role="search" className="relative" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="search-q" className="sr-only">
        {t("search.fieldLabel")}
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg text-fg-muted" />
      <input
        id="search-q"
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={100}
        autoFocus
        placeholder={t("nav.searchPlaceholder")}
        className="w-full rounded-md border border-border bg-surface py-3 pr-4 pl-11 text-lg text-fg placeholder:text-fg-muted/70 focus:border-star focus:outline-none"
      />
      {type !== "all" && <input type="hidden" name="type" value={type} />}
    </form>
  );
}
