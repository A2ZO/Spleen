import { getLocale, getTranslations } from "next-intl/server";

import { SearchIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";

/**
 * Plain GET form to the search page: works before (and without) JavaScript. On small screens
 * it is a search icon linking to the search page, which has a full-width field.
 */
export async function HeaderSearch() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  return (
    <>
      <Link
        href="/search"
        className="ml-auto rounded-md p-2 text-lg text-fg-muted hover:text-fg sm:hidden"
      >
        <SearchIcon />
        <span className="sr-only">{t("searchLabel")}</span>
      </Link>
      <form
        role="search"
        action={`/${locale}/search`}
        className="relative hidden min-w-0 flex-1 sm:ml-auto sm:block sm:max-w-xs"
      >
        <label htmlFor="header-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
        <input
          id="header-search"
          type="search"
          name="q"
          maxLength={100}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-md border border-border bg-surface py-1.5 pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted/70 focus:border-star focus:outline-none"
        />
      </form>
    </>
  );
}
